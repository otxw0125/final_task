import { connectToDatabase } from "@/lib/db/mongodb";
import { getAngleDataCollection, getRawSensorDataCollection } from "@/lib/db/collections";
import { AngleDataWithId } from "@/lib/models/AngleData";
import { RawSensorDataWithId, RawSensorValues } from "@/lib/models/RawSensorData";
import { CurrentPostureFeedback, generatePostureFeedbackFromAngleData } from "@/lib/utils/postureEvaluator";
import { convertAccelToAngles } from "@/lib/utils/conversion";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '데이터 변환 뷰어',
  description: '최근 RawSensorData, 변환된 AngleData 및 피드백 데이터를 확인합니다.',
};

async function getRecentAngleData(limit = 50): Promise<AngleDataWithId[]> {
  try {
    await connectToDatabase();
    const angleDataCollection = await getAngleDataCollection();
    const data = await angleDataCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    // MongoDB BSON ObjectId를 문자열로 변환하고, Date 객체를 ISODate 문자열로 변환
    return data.map((item: any) => ({
      ...item,
      _id: item._id.toString(),
      timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : String(item.timestamp),
    })) as AngleDataWithId[];
  } catch (error) {
    console.error("[DataViewerPage] Error fetching recent angle data:", error);
    return [];
  }
}

async function getRecentRawSensorData(limit = 50): Promise<RawSensorDataWithId[]> {
  try {
    await connectToDatabase();
    const rawSensorDataCollection = await getRawSensorDataCollection();
    const data = await rawSensorDataCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return data.map((item: any) => ({
      ...item,
      _id: item._id.toString(),
      timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : String(item.timestamp),
      // sensor_values는 이미 객체이므로 별도 변환 필요 없음
    })) as RawSensorDataWithId[];
  } catch (error) {
    console.error("[DataViewerPage] Error fetching recent raw sensor data:", error);
    return [];
  }
}

export default async function DataViewerPage() {
  const recentRawSensorData = await getRecentRawSensorData(50);

  const processedDataFromRaw = recentRawSensorData
    .map(rawData => {
      // sensor_values가 유효한지 확인
      if (!rawData.sensor_values || typeof rawData.sensor_values.x_accel === 'undefined') {
        console.warn(`[DataViewerPage] Skipping rawData due to missing or invalid sensor_values. ID: ${rawData._id}`);
        return null; // 유효하지 않은 데이터는 건너뜀
      }

      const convertedAngles = convertAccelToAngles(rawData.sensor_values);
      const feedbackInput = {
        angles: convertedAngles,
        timestamp: rawData.timestamp, // 이미 string으로 변환됨
      };
      const feedback = generatePostureFeedbackFromAngleData(feedbackInput);
      return {
        originalRawId: rawData._id,
        rawSensorValues: rawData.sensor_values,
        convertedAngles: convertedAngles,
        feedback: feedback,
        originalTimestamp: rawData.timestamp,
        sensorNumber: rawData.number,
      };
    })
    .filter(data => data !== null) as any[]; // null 값을 필터링하여 제거

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">데이터 변환 상태 뷰어</h1>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Raw Sensor Data 변환 및 피드백 (최근 50개)</h2>
        {processedDataFromRaw.length > 0 ? (
          <div className="overflow-x-auto shadow-md sm:rounded-lg" style={{maxHeight: '80vh'}}>
            <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3">Raw ID</th>
                  <th scope="col" className="px-4 py-3">Timestamp</th>
                  <th scope="col" className="px-4 py-3">Sensor No.</th>
                  <th scope="col" className="px-4 py-3">Raw Accel (x,y,z)</th>
                  <th scope="col" className="px-4 py-3">Converted Angles (x,y,z)</th>
                  <th scope="col" className="px-4 py-3">Feedback Score</th>
                  <th scope="col" className="px-4 py-3">Feedback Risk</th>
                  <th scope="col" className="px-4 py-3">Summary</th>
                  <th scope="col" className="px-4 py-3">Advice Count</th>
                </tr>
              </thead>
              <tbody>
                {processedDataFromRaw.map((data) => (
                  <tr key={data.originalRawId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-4 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{data.originalRawId}</td>
                    <td className="px-4 py-4">{new Date(data.originalTimestamp).toLocaleString()}</td>
                    <td className="px-4 py-4">{data.sensorNumber ?? 'N/A'}</td>
                    <td className="px-4 py-4">{`x:${data.rawSensorValues.x_accel}, y:${data.rawSensorValues.y_accel}, z:${data.rawSensorValues.z_accel}`}</td>
                    <td className="px-4 py-4">{`x:${data.convertedAngles.x}, y:${data.convertedAngles.y}, z:${data.convertedAngles.z}`}</td>
                    <td className="px-4 py-4">{data.feedback.overallScore}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold 
                        ${data.feedback.riskLevel === 'danger' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-200' : 
                          data.feedback.riskLevel === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200' : 
                          data.feedback.riskLevel === 'safe' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}\`
                        `}>
                        {data.feedback.riskLevel || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4 truncate max-w-xs" title={data.feedback.summaryMessage}>{data.feedback.summaryMessage}</td>
                    <td className="px-4 py-4">{data.feedback.detailedAdvice.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">표시할 Raw Sensor 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
} 