import React from 'react';
import { Link } from 'react-router-dom';

export function GuidePage() {
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="card" style={{ background: '#212121', marginBottom: 16 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="mono" style={{ fontWeight: 900, fontSize: 22 }}>
            AGENT_CONTROL_CENTER // 실사용 예시 가이드 (KR)
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn btnOutline" to="/help">
              Help
            </Link>
            <Link className="btn" style={{ borderColor: '#22c55e', color: '#22c55e', background: 'transparent' }} to="/">
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="mono" style={{ marginTop: 14, color: '#d4d4d8', lineHeight: 1.7, fontSize: 13 }}>
          <div style={{ color: '#a1a1aa' }}>
            목적: “이 화면을 어디서 어떻게 눌러야 하는지”를 예시로 명확하게 설명합니다.
          </div>

          <h3 style={{ marginTop: 18, color: '#e5e7eb' }}>예시 시나리오 A) 배포 장애 대응 (Plan → Exec → Verify)</h3>
          <ol>
            <li>
              <b>새 Task 생성</b>
              <ul>
                <li>Dashboard → <b>new_task</b> 클릭</li>
                <li>summary 예: <code>"prod 배포 실패: migration lock"</code></li>
                <li>생성되면 자동으로 Task Detail로 이동</li>
              </ul>
            </li>
            <li>
              <b>Plan 실행</b>
              <ul>
                <li>Task Detail → Stage Controls에서 <b>Plan</b> 실행</li>
                <li>architect 로그에서 설계/가설/체크리스트가 나오는지 확인</li>
              </ul>
            </li>
            <li>
              <b>Exec 실행</b>
              <ul>
                <li>Stage Controls에서 <b>Exec</b> 실행</li>
                <li>executor 로그에서 실제 변경/명령 실행 흐름 확인</li>
              </ul>
            </li>
            <li>
              <b>Verify 실행</b>
              <ul>
                <li>Stage Controls에서 <b>Verify</b> 실행</li>
                <li>qa 로그에서 테스트/검증 결과(PASS/FAIL)를 확인</li>
              </ul>
            </li>
            <li>
              <b>실패하면 Fix Loop</b>
              <ul>
                <li>Verify/Review가 실패하거나 timeout이면 <b>Fix Loop</b> 실행</li>
                <li>원인 파악 → 최소 수정 → 재검증 흐름 반복</li>
              </ul>
            </li>
          </ol>

          <h3 style={{ marginTop: 18, color: '#e5e7eb' }}>예시 시나리오 B) 특정 역할에게만 명령 보내기</h3>
          <ol>
            <li>
              Task Detail에서 원하는 역할 카드 오른쪽의 <b>console</b> 클릭
              <ul>
                <li>경로 예: <code>/tasks/&lt;taskId&gt;/console/executor</code></li>
              </ul>
            </li>
            <li>
              Console의 <b>COMMAND_FOCUS</b> 입력에 명령 작성 후 Enter
              <ul>
                <li>예: <code>"rerun verify --suite=integration --timeout=120"</code></li>
                <li>예: <code>"show last 200 lines of error"</code></li>
              </ul>
            </li>
            <li>
              결과는 동일 역할의 로그 스트림으로 다시 확인
            </li>
          </ol>

          <h3 style={{ marginTop: 18, color: '#e5e7eb' }}>로그 활용 팁 (search / regex / copy / expand)</h3>
          <ul>
            <li>
              <b>search</b>: 단어 기반 필터링/하이라이트
              <ul>
                <li>예: <code>timeout</code>, <code>ERROR</code>, <code>kubectl</code></li>
              </ul>
            </li>
            <li>
              <b>regex</b>: 정규식으로 빠르게 좁히기
              <ul>
                <li>예: <code>ERROR|WARN</code></li>
                <li>예: <code>exit\s+\d+</code></li>
              </ul>
            </li>
            <li>
              <b>copy</b>: 필터된 로그를 그대로 복사해서 공유/기록
            </li>
            <li>
              <b>expand</b>: 긴 로그는 모달로 크게 띄워서 확인
            </li>
          </ul>

          <h3 style={{ marginTop: 18, color: '#e5e7eb' }}>자주 겪는 문제 / 해결</h3>
          <ul>
            <li>
              역할이 섞여 보일 때: Task Detail 상단의 <b>Sync pane titles</b>로 역할명을 다시 맞춤
            </li>
            <li>
              모바일에서 버튼이 안 보일 때: 주소 끝에 <code>/</code>가 빠졌거나 캐시 문제일 수 있으니 강력 새로고침/시크릿 모드로 확인
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
