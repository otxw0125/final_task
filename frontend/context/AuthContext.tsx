import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios'; // 또는 fetch 사용

interface User {
  _id: string;
  username: string;
  // 필요하다면 다른 사용자 필드 추가
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void; // 단순화된 로그인 함수
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 로드 시 인증 상태 확인
  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true);
      try {
        // 백엔드에 로그인된 경우 사용자 데이터를 반환하는 '/api/me' 엔드포인트가 있다고 가정
        // 이 백엔드 엔드포인트는 세션을 사용하여 사용자를 찾아야 함
        const response = await axios.get('/api/me', { // 상대 URL 또는 백엔드 전체 URL 사용
          baseURL: 'http://localhost:3000', // 여러분의 Node.js 백엔드 URL
          withCredentials: true, // 중요: 쿠키 전송 설정
        });
        if (response.data) {
          setUser(response.data);
        }
      } catch (error) {
        console.error('인증되지 않음:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

   const logout = async () => {
     try {
        // 백엔드 로그아웃 엔드포인트 호출
        await axios.get('/logout', { // 상대 URL 또는 백엔드 전체 URL 사용
            baseURL: 'http://localhost:3000', // 여러분의 Node.js 백엔드 URL
            withCredentials: true,
        });
        setUser(null);
        // 선택 사항: next/router를 사용하여 로그인 페이지로 리디렉션
     } catch (error) {
         console.error('로그아웃 실패:', error);
     }
  };


  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내에서 사용해야 합니다');
  }
  return context;
};