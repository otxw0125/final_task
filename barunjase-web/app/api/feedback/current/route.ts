import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';

export interface CurrentPostureFeedback {
  success: boolean;
  message: string;
  feedbackPerAxis: {
    x?: {
      angle: number;
      risk: 'safe' | 'warning' | 'danger';
      normalRange: { min: number; max: number };
      message: string;
    };
    y?: {
      angle: number;
      risk: 'safe' | 'warning' | 'danger';
      normalRange: { min: number; max: number };
      message: string;
    };
  };
  overallScore?: number;
  dataStats?: {
    totalAngleData: number;
    latestDataTimestamp: string;
    riskDistribution: {
      safe: number;
      warning: number;
      danger: number;
    };
    recentDataTrend: Array<{
      timestamp: string;
      count: number;
    }>;
  };
  timestamp: string;
}

// 정상 범위 정의 (앉은 자세용 - 더 현실적으로 조정)
const NORMAL_RANGES = {
  y: { min: -15, max: 15 },  // 좌우 기울기
  x: { min: -20, max: 20 }   // 상하 기울기 (허리에 부담)
};

function getRiskLevel(angle: number, range: { min: number; max: number }): 'safe' | 'warning' | 'danger' {
  if (angle >= range.min && angle <= range.max) {
    return 'safe';
  }
  
  const deviation = Math.min(Math.abs(angle - range.min), Math.abs(angle - range.max));
  
  if (deviation <= 15) { // 15도 이내 벗어남을 warning으로 조정
    return 'warning';
  }
  
  return 'danger'; // 15도 이상 벗어남
}

function generateMessage(angle: number, axis: string, risk: 'safe' | 'warning' | 'danger'): string {
  const axisNames = {
    y: { name: '좌우 기울기', direction: angle > 0 ? '오른쪽' : '왼쪽', body: '목과 어깨에' },
    x: { name: '상하 기울기', direction: angle > 0 ? '위쪽' : '아래쪽', body: '허리에' }
  };
  
  const axisInfo = axisNames[axis as keyof typeof axisNames];
  
  switch (risk) {
    case 'safe':
      return `${axisInfo.name}의 정상 범위입니다.`;
    case 'warning':
      return `${axisInfo.name}의 ${axisInfo.direction}으로 약간 기울어져 있습니다. ${axisInfo.body} 부담이 갈 수 있어요.`;
    case 'danger':
      return `${axisInfo.name}의 ${axisInfo.direction}으로 많이 기울어져 있습니다. ${axisInfo.body} 부담이 가고 있어요. 즉시 자세를 교정해주세요.`;
    default:
      return `${axisInfo.name}의 상태를 확인할 수 없습니다.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const angleDataCollection = await getAngleDataCollection();
    
    // 가장 최근 각도 데이터 조회
    const latestAngleData = await angleDataCollection
      .findOne(
        {},
        { sort: { timestamp: -1 } }
      );

    if (!latestAngleData) {
      return NextResponse.json({
        success: false,
        message: '각도 데이터를 찾을 수 없습니다.',
        feedbackPerAxis: {},
        timestamp: new Date().toISOString()
      } as CurrentPostureFeedback);
    }

    const angles = latestAngleData.angles;
    
    // X축 (좌우 기울기) 피드백 - 목과 어깨에 부담
    const xRisk = getRiskLevel(angles.x, NORMAL_RANGES.x);
    const xFeedback = {
      angle: angles.x,
      risk: xRisk,
      normalRange: NORMAL_RANGES.x,
      message: generateMessage(angles.x, 'x', xRisk)
    };

    // Y축 (상하 기울기) 피드백 - 허리에 부담
    const yRisk = getRiskLevel(angles.y, NORMAL_RANGES.y);
    const yFeedback = {
      angle: angles.y,
      risk: yRisk,
      normalRange: NORMAL_RANGES.y,
      message: generateMessage(angles.y, 'y', yRisk)
    };

    // 전체 점수 계산
    const xScore = xRisk === 'safe' ? 100 : (xRisk === 'warning' ? 70 : 30);
    const yScore = yRisk === 'safe' ? 100 : (yRisk === 'warning' ? 70 : 30);
    const overallScore = Math.round((xScore + yScore) / 2);

    // 위험도 분포 계산 (최근 100개 데이터)
    const recentAngleData = await angleDataCollection
      .find({}, { sort: { timestamp: -1 }, limit: 100 })
      .toArray();

    const riskDistribution = {
      safe: 0,
      warning: 0,
      danger: 0
    };

    recentAngleData.forEach(data => {
      const xRiskLevel = getRiskLevel(data.angles.x, NORMAL_RANGES.x);
      const yRiskLevel = getRiskLevel(data.angles.y, NORMAL_RANGES.y);
      
      // 더 위험한 축의 위험도를 사용
      const overallRisk = (xRiskLevel === 'danger' || yRiskLevel === 'danger') ? 'danger' :
                         (xRiskLevel === 'warning' || yRiskLevel === 'warning') ? 'warning' : 'safe';
      
      riskDistribution[overallRisk]++;
    });

    // 최근 24시간 데이터 트렌드 (시간별)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyData = await angleDataCollection.aggregate([
      {
        $match: {
          timestamp: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestamp"
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      },
      {
        $limit: 24
      }
    ]).toArray();

    const recentDataTrend = hourlyData.map(item => ({
      timestamp: item._id,
      count: item.count
    }));

    return NextResponse.json({
      success: true,
      message: '현재 자세 피드백을 성공적으로 조회했습니다.',
      feedbackPerAxis: {
        x: xFeedback,
        y: yFeedback
      },
      overallScore,
      dataStats: {
        totalAngleData: await angleDataCollection.countDocuments(),
        latestDataTimestamp: latestAngleData.timestamp instanceof Date 
          ? latestAngleData.timestamp.toISOString() 
          : latestAngleData.timestamp,
        riskDistribution,
        recentDataTrend
      },
      timestamp: new Date().toISOString()
    } as CurrentPostureFeedback);

  } catch (error) {
    console.error('현재 자세 피드백 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '피드백 조회 중 오류가 발생했습니다.',
      feedbackPerAxis: {},
      timestamp: new Date().toISOString()
    } as CurrentPostureFeedback, { status: 500 });
  }
} 