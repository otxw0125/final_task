import { ObjectId } from 'mongodb';

export interface PostureScore {
  _id?: ObjectId;
  number: number;
  score: number; // 0-100 범위의 종합 점수
  categoryScores: {
    neck: number; // X축 관련 점수
    back: number; // Y축 관련 점수
    rotation: number; // Z축 관련 점수
  };
  feedback: string; // 자세 피드백 메시지
  timestamp: Date;
}

export const PostureScoreCollection = 'posturescore';

/**
 * 자세 점수 생성 함수
 */
export function createPostureScore(
  number: number,
  score: number,
  neckScore: number,
  backScore: number,
  rotationScore: number,
  feedback: string,
  timestamp: Date = new Date()
): PostureScore {
  return {
    number,
    score,
    categoryScores: {
      neck: neckScore,
      back: backScore,
      rotation: rotationScore,
    },
    feedback,
    timestamp,
  };
}