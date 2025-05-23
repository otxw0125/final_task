import { test, expect } from '@playwright/test';

test.describe('Dashboard Page E2E Test', () => {
  test('should load and display dashboard data correctly', async ({ page }) => {
    // Mock API 응답 (제거)
    // await page.route('**/api/feedback/current', async route => { ... });
    // await page.route('**/api/feedback/history**', async route => { ... });

    // 모든 API 응답 로깅 (필터링 없이)
    page.on('response', async (response) => {
      console.log(`<< API Response: ${response.status()} ${response.url()}`);
      try {
        // JSON 응답만 파싱 시도
        if (response.headers()['content-type']?.includes('application/json')) {
          const json = await response.json();
          console.log(JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.log('Could not parse or read response body.');
      }
    });

    // 1. 대시보드 페이지로 이동
    await page.goto('/dashboard');

    // 2. 페이지 제목 확인
    await expect(page.getByRole('heading', { name: '자세 대시보드' })).toHaveText('자세 대시보드');

    // 3. 데이터 로드 후 상태 확인 (실제 API 호출 기대)
    await expect(page.getByText('종합 자세 점수:')).toBeVisible({ timeout: 15000 });
    
    const scoreElement = page.getByTestId('overall-score');
    await expect(scoreElement).not.toHaveText('0점', { timeout: 20000 }); 
    await expect(scoreElement).toContainText(/점/);

    await expect(page.getByText('요약:').locator('xpath=following-sibling::p')).not.toBeEmpty({ timeout: 10000});
    await expect(page.getByText('상세 조언:').locator('xpath=following-sibling::ul/li').first()).toBeVisible({ timeout: 10000 });
    
    const historyViz = page.getByTestId('posture-history-viz');

    await expect(historyViz.getByRole('heading', { name: '시간대별 자세 상태 (평균 점수)' })).toBeVisible({ timeout: 10000 });
    await expect(historyViz.getByRole('heading', { name: '자세 점수 변화 추이' })).toBeVisible({ timeout: 10000 });
    
    const barChartBars = historyViz.locator('.recharts-bar-rectangle');
    await expect(barChartBars.first()).toBeVisible({ timeout: 15000 }); 

  });
}); 