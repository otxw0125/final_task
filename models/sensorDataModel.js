// models/sensorDataModel.js

/**
 * 센서 데이터를 MongoDB에 저장하거나 조회하기 위한 유틸리티 함수 모음입니다.
 */

/**
 * 센서 데이터를 데이터베이스에 삽입합니다.
 * @param {Object} db - MongoDB 데이터베이스 객체
 * @param {Object} sensorData - 저장할 센서 데이터 객체 (예: { userId, timestamp, tilt })
 */
async function insertSensorData(db, sensorData) {
    try {
      const result = await db.collection('sensorData').insertOne(sensorData);
      return result;
    } catch (error) {
      throw new Error('센서 데이터 삽입 중 오류 발생: ' + error);
    }
  }
  
  /**
   * 특정 사용자(userId)의 센서 데이터를 타임스탬프 순으로 조회합니다.
   * @param {Object} db - MongoDB 데이터베이스 객체
   * @param {String|Object} userId - 사용자 식별자
   */
  async function getSensorDataByUser(db, userId) {
    try {
      const data = await db.collection('sensorData')
        .find({ userId: userId })
        .sort({ timestamp: 1 })
        .toArray();
      return data;
    } catch (error) {
      throw new Error('센서 데이터 조회 중 오류 발생: ' + error);
    }
  }
  
  module.exports = {
    insertSensorData,
    getSensorDataByUser
  };
  