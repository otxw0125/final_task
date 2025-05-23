import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';
import { AngleData } from '../../../../lib/models/AngleData';
import { Collection, Document, Filter, Sort } from 'mongodb';

/**
 * 각도 데이터 조회 API 엔드포인트
 * 
 * 이 API는 가속도 센서 데이터로부터 계산된 각도 데이터를 조회합니다.
 * 다양한 필터링 및 시간 단위별 집계 기능을 제공합니다.
 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * GET 요청 핸들러 - 각도 데이터 조회
 * 
 * 쿼리 파라미터:
 * - limit: 조회할 데이터 개수 (기본값: 10, 최대값: 100)
 * - offset: 건너뛸 데이터 개수 (기본값: 0)
 * - startDate: 시작 날짜 (ISO 형식, 예: "2023-01-01T00:00:00.000Z")
 * - endDate: 종료 날짜 (ISO 형식, 예: "2023-01-31T23:59:59.999Z")
 * - timeUnit: 시간 단위로 집계 ('hour', 'day', 'week', 'month')
 * - minScore: 최소 자세 점수 (0-100)
 * - maxScore: 최대 자세 점수 (0-100)
 * - category: 자세 카테고리 ('good', 'moderate', 'poor')
 * - sort: 정렬 필드 (기본값: 'timestamp' 또는 집계 시 'periodStart')
 *          사용 가능한 필드: 'timestamp', 'angles.x', 'angles.y', 'angles.z', 'scoreData.score' 등
 * - order: 정렬 방향 ('asc' 또는 'desc', 기본값: 'desc')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collection = await getAngleDataCollection();

    // 파라미터 추출 및 기본값 설정
    const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const timeUnit = searchParams.get('timeUnit');
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');
    const category = searchParams.get('category');
    let sort = searchParams.get('sort') || (timeUnit ? 'periodStart' : 'timestamp');
    const orderStr = searchParams.get('order')?.toLowerCase() || 'desc';
    const order = orderStr === 'asc' ? 1 : -1;

    // MongoDB 쿼리 객체 생성
    const query: Filter<AngleData> = {};

    // 날짜 범위 필터링
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        try {
          query.timestamp.$gte = new Date(startDate);
        } catch (e) {
          return NextResponse.json({ success: false, error: "Invalid startDate format. Use ISO date format." }, { status: 400 });
        }
      }
      if (endDate) {
        try {
          query.timestamp.$lte = new Date(endDate);
        } catch (e) {
          return NextResponse.json({ success: false, error: "Invalid endDate format. Use ISO date format." }, { status: 400 });
        }
      }
    }

    // 점수 범위 필터링
    if (minScore || maxScore) {
      query['scoreData.score'] = {};
      if (minScore) {
        const score = parseFloat(minScore);
        if (isNaN(score) || score < 0 || score > 100) {
          return NextResponse.json({ success: false, error: "Invalid minScore. Must be a number between 0 and 100." }, { status: 400 });
        }
        query['scoreData.score'].$gte = score;
      }
      if (maxScore) {
        const score = parseFloat(maxScore);
        if (isNaN(score) || score < 0 || score > 100) {
          return NextResponse.json({ success: false, error: "Invalid maxScore. Must be a number between 0 and 100." }, { status: 400 });
        }
        query['scoreData.score'].$lte = score;
      }
    }

    // 카테고리 필터링
    if (category) {
      const validCategories = ['good', 'moderate', 'poor'];
      if (!validCategories.includes(category.toLowerCase())) {
        return NextResponse.json({ success: false, error: `Invalid category. Valid options are: ${validCategories.join(', ')}` }, { status: 400 });
      }
      query['scoreData.category'] = category.toLowerCase() as 'good' | 'moderate' | 'poor';
    }
    
    // 정렬 객체 생성
    const sortOption: Sort = {};
    // MongoDB는 중첩 필드 정렬 시 문자열 경로를 사용합니다.
    // 예: 'scoreData.score'
    sortOption[sort] = order;

    if (timeUnit) {
      // 시간 단위 집계 로직 호출
      return getAggregatedData(collection, query, timeUnit, sort, order, searchParams);
    } else {
      // 일반 데이터 조회
      const totalRecords = await collection.countDocuments(query);
      const data = await collection
        .find(query)
        .sort(sortOption)
        .skip(offset)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        data: data,
        pagination: {
          total: totalRecords,
          limit,
          offset,
          hasMore: offset + data.length < totalRecords,
        },
        query: Object.fromEntries(searchParams.entries()), // 실제 적용된 쿼리 파라미터 반환
      });
    }
  } catch (error) {
    console.error('Error in GET /api/sensor-data/angle:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch angle data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 시간 단위별 집계 데이터 조회 함수
 */
async function getAggregatedData(
  collection: Collection<AngleData>, 
  query: Filter<AngleData>, 
  timeUnit: string,
  sortField: string, // 집계 결과에 대한 정렬 필드
  sortOrder: 1 | -1, // 집계 결과에 대한 정렬 순서
  originalSearchParams: URLSearchParams // 원본 파라미터 로깅용
) {
  let dateFormat: any;
  let groupId: any = {};

  switch(timeUnit.toLowerCase()) {
    case 'hour':
      groupId = {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" },
        hour: { $hour: "$timestamp" }
      };
      dateFormat = "%Y-%m-%dT%H:00:00.000Z"; // 시간까지 표현
      break;
    case 'day':
      groupId = {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" }
      };
      dateFormat = "%Y-%m-%dT00:00:00.000Z"; // 날짜까지만 표현
      break;
    case 'week':
      // $week 연산자는 해당 주의 일요일을 기준으로 하므로, ISO 주를 원한다면 $isoWeek를 사용해야 합니다.
      // 여기서는 MongoDB의 기본 $week를 사용합니다.
      groupId = {
        year: { $year: "$timestamp" }, // $isoWeekYear 와 함께 사용 고려
        week: { $week: "$timestamp" }
      };
      // 주 단위의 대표 날짜는 생성하기 복잡하므로, year와 week 번호로 그룹화합니다.
      // 필요시 $dateFromParts 등을 사용해 주의 시작일을 만들 수 있습니다.
      break;
    case 'month':
      groupId = {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" }
      };
      dateFormat = "%Y-%m-01T00:00:00.000Z"; // 해당 월의 1일로 표현
      break;
    default:
      return NextResponse.json(
        { success: false, error: `Invalid time unit: ${timeUnit}. Valid options are: hour, day, week, month` },
        { status: 400 }
      );
  }
  
  const pipeline: Document[] = [
    { $match: query },
    { 
      $group: {
        _id: groupId,
        avgAngleX: { $avg: "$angles.x" },
        avgAngleY: { $avg: "$angles.y" },
        avgAngleZ: { $avg: "$angles.z" },
        avgFilteredX: { $avg: "$filtered.x" },
        avgFilteredY: { $avg: "$filtered.y" },
        avgFilteredZ: { $avg: "$filtered.z" },
        avgScore: { $avg: "$scoreData.score" },
        countGood: { $sum: { $cond: [{ $eq: ["$scoreData.category", "good"] }, 1, 0] } },
        countModerate: { $sum: { $cond: [{ $eq: ["$scoreData.category", "moderate"] }, 1, 0] } },
        countPoor: { $sum: { $cond: [{ $eq: ["$scoreData.category", "poor"] }, 1, 0] } },
        totalCount: { $sum: 1 },
        minTimestamp: { $min: "$timestamp" }, // 그룹 내 최소 시간
        maxTimestamp: { $max: "$timestamp" }  // 그룹 내 최대 시간
      }
    },
    {
      $project: {
        _id: 0, // _id 필드 제거
        timeGroup: "$_id", // 그룹화된 시간 정보
        // dateFormat이 있는 경우, 대표 시간 문자열 생성 (week는 제외)
        ...(dateFormat ? { periodStart: { $dateToString: { format: dateFormat, date: "$minTimestamp", timezone: "UTC" } } } : {}),
        periodEnd: { $dateToString: { format: "%Y-%m-%dT%H:%M:%S.%LZ", date: "$maxTimestamp", timezone: "UTC" } },
        avgAngles: {
          x: { $ifNull: [{ $round: ["$avgAngleX", 2] }, null] },
          y: { $ifNull: [{ $round: ["$avgAngleY", 2] }, null] },
          z: { $ifNull: [{ $round: ["$avgAngleZ", 2] }, null] }
        },
        avgFiltered: {
          x: { $ifNull: [{ $round: ["$avgFilteredX", 2] }, null] },
          y: { $ifNull: [{ $round: ["$avgFilteredY", 2] }, null] },
          z: { $ifNull: [{ $round: ["$avgFilteredZ", 2] }, null] }
        },
        scoreData: {
          avgScore: { $ifNull: [{ $round: ["$avgScore", 1] }, null] },
          goodPercentage: { 
            $cond: {
              if: { $gt: ["$totalCount", 0] },
              then: { $round: [{ $multiply: [{ $divide: ["$countGood", "$totalCount"] }, 100] }, 1] },
              else: 0
            }
          },
          moderatePercentage: {
            $cond: {
              if: { $gt: ["$totalCount", 0] },
              then: { $round: [{ $multiply: [{ $divide: ["$countModerate", "$totalCount"] }, 100] }, 1] },
              else: 0
            }
          },
          poorPercentage: {
            $cond: {
              if: { $gt: ["$totalCount", 0] },
              then: { $round: [{ $multiply: [{ $divide: ["$countPoor", "$totalCount"] }, 100] }, 1] },
              else: 0
            }
          }
        },
        samples: "$totalCount",
      }
    }
  ];
  
  // 집계 결과에 대한 정렬 추가
  // periodStart는 $project 단계에서 생성되므로, 정렬은 그 이후에 적용해야 합니다.
  // timeGroup은 _id를 기반으로 하므로, 이를 기준으로 정렬할 수 있습니다.
  const effectiveSortField = sortField === 'periodStart' ? (timeUnit === 'week' ? 'timeGroup.year' : 'periodStart') : sortField;
  const sortStage: Sort = {};
  
  if (timeUnit === 'week' && sortField === 'periodStart') {
    // 주 단위 정렬 시 year 먼저, 그 다음 week
    sortStage['timeGroup.year'] = sortOrder;
    sortStage['timeGroup.week'] = sortOrder;
  } else {
    sortStage[effectiveSortField] = sortOrder;
  }
  pipeline.push({ $sort: sortStage });

  // 페이지네이션을 위한 limit, offset 적용 (집계 후)
  const limitParam = parseInt(originalSearchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const offsetParam = parseInt(originalSearchParams.get('offset') || '0', 10);

  // 전체 집계 결과 수 계산을 위해 $count 추가 (페이지네이션용)
  const countPipeline = [...pipeline, { $count: 'totalAggregatedRecords' }];
  const countResult = await collection.aggregate(countPipeline).toArray();
  const totalAggregatedRecords = countResult.length > 0 ? countResult[0].totalAggregatedRecords : 0;

  pipeline.push({ $skip: offsetParam });
  pipeline.push({ $limit: Math.min(limitParam, MAX_LIMIT) });
  
  const aggregatedData = await collection.aggregate(pipeline).toArray();
  
  return NextResponse.json({
    success: true,
    data: aggregatedData,
    timeUnit,
    pagination: {
      total: totalAggregatedRecords,
      limit: Math.min(limitParam, MAX_LIMIT),
      offset: offsetParam,
      hasMore: offsetParam + aggregatedData.length < totalAggregatedRecords,
    },
    query: {
      ...Object.fromEntries(originalSearchParams.entries()),
      appliedFilters: Object.keys(query).length > 0,
      timeUnit, // 명시적으로 timeUnit 포함
    }
  });
}

/**
 * 최신 각도 데이터 조회 함수 (참고용으로 남겨둠, 현재 GET 핸들러에서는 직접 사용 안 함)
 * 이 기능이 필요하다면 별도의 엔드포인트 (/api/angle-data/latest 등) 또는
 * GET 핸들러 내에서 특정 조건(예: limit=1이고 다른 필터 없음)일 때 호출하도록 할 수 있습니다.
 */
export async function getLatestAngleData(): Promise<AngleData | null> {
  try {
    const collection = await getAngleDataCollection();
    const latestDataArray = await collection // AngleData 타입으로 캐스팅하지 않음
      .find({})
      .sort({ timestamp: -1 } as Sort) // 타입 명시
      .limit(1)
      .toArray();
    
    // MongoDB 드라이버는 Document[]를 반환하므로, AngleData로 단언하기 전에 확인
    return latestDataArray.length > 0 ? latestDataArray[0] as AngleData : null;
  } catch (error) {
    console.error('Error fetching latest angle data:', error);
    return null;
  }
} 