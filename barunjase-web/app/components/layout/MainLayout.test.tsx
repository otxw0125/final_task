import { render, screen } from '@testing-library/react'
import MainLayout from './MainLayout'
import Header from './Header' // Mock annehmen
import Footer from './Footer' // Mock annehmen

// Header와 Footer 컴포넌트를 모킹합니다.
// 실제 컴포넌트 대신 간단한 JSX를 반환하도록 설정합니다.
// 이렇게 하면 MainLayout 테스트가 Header나 Footer의 내부 구현에 의존하지 않게 됩니다.
jest.mock('./Header', () => () => <header>Header Mock</header>)
jest.mock('./Footer', () => () => <footer>Footer Mock</footer>)

describe('MainLayout', () => {
  it('renders Header, Footer and children', () => {
    const testMessage = 'Test Children'
    render(
      <MainLayout>
        <div>{testMessage}</div>
      </MainLayout>
    )

    // Header와 Footer가 렌더링되었는지 확인합니다.
    // 모킹된 컴포넌트의 내용을 기반으로 확인합니다.
    expect(screen.getByText('Header Mock')).toBeInTheDocument()
    expect(screen.getByText('Footer Mock')).toBeInTheDocument()

    // children으로 전달된 내용이 렌더링되었는지 확인합니다.
    expect(screen.getByText(testMessage)).toBeInTheDocument()
  })
}) 