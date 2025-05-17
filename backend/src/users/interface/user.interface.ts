export interface User {
  _id: string;
  username: string;
  email?: string;      // 선택 필드라면 옵셔널로
  createdAt?: string;  // 날짜도 문자열로
  // TODO: role, permissions 등 추가 속성
}