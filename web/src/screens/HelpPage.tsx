import React from 'react';
import { Link } from 'react-router-dom';

export function HelpPage() {
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="card" style={{ background: '#212121', marginBottom: 16 }}>
        <div className="spread">
          <div style={{ fontWeight: 900, fontSize: 22 }}>AGENT_CONTROL_CENTER // 사용 가이드 (KR)</div>
          <Link className="btn" style={{ borderColor: '#22c55e', color: '#22c55e', background: 'transparent' }} to="/">
            Back to Dashboard
          </Link>
        </div>
        <div className="mono" style={{ marginTop: 10, color: '#a1a1aa', lineHeight: 1.7, fontSize: 13 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link className="btn btnOutline" to="/guide">
              실사용 예시 가이드 보기
            </Link>
          </div>

          <h3 style={{ marginTop: 16, fontWeight: 900, color: '#e5e7eb' }}>이 프로그램의 의도</h3>
          <ul>
            <li>
              여러 에이전트(architect/executor/qa/reviewer)를 <b>동시에</b> 운용할 때, “누가 무엇을 했는지/하고 있는지”를 한 화면에서
              관찰하고 제어하기 위한 <b>운영 콘솔</b>입니다.
            </li>
            <li>
              목표는 2가지입니다: (1) <b>진행 가시화</b>(로그/상태/스테이지) (2) <b>안전한 조작</b>(역할별 명령 전송, 단계 실행, 중단/삭제).
            </li>
          </ul>

          <h3 style={{ marginTop: 16, fontWeight: 900, color: '#e5e7eb' }}>동작 원리(아키텍처 개요)</h3>
          <ul>
            <li>
              백엔드는 tmux 세션(<code>codex-pool</code>)의 각 pane을 역할로 매핑하고, 웹에서 요청이 오면 tmux로 <b>명령을 전송</b>합니다.
              (send-keys)
            </li>
            <li>
              로그는 주기적으로 tmux <b>capture-pane</b>으로 읽어서 웹소켓(<code>/ws</code>)으로 스트리밍합니다.
            </li>
            <li>
              Task는 서버의 스토어 파일(<code>/data/acc-store.json</code>)로 저장되어 재시작 후에도 유지됩니다.
            </li>
          </ul>

          <h3 style={{ marginTop: 16, fontWeight: 900, color: '#e5e7eb' }}>화면별 역할</h3>
          <ul>
            <li>
              <b>Dashboard</b>: 작업 목록/상태 확인, 새 작업 생성, terminate/delete
            </li>
            <li>
              <b>Task Detail</b>: 역할별 live log 확인 + stage 실행 + orchestrator(연쇄 실행) + 단일 커맨드 전송
            </li>
            <li>
              <b>Agent Console</b>: 특정 역할의 로그를 더 깊게 검색/하이라이트/북마크하고, 그 역할에게만 명령을 집중 전송
            </li>
          </ul>

          <h3 style={{ marginTop: 16, fontWeight: 900, color: '#e5e7eb' }}>핵심 기능 설명</h3>
          <ol>
            <li>
              <b>작업(Task) 생성</b>
              <ul>
                <li>Dashboard에서 <b>new_task</b> → summary 입력 → Task Detail로 이동</li>
              </ul>
            </li>
            <li>
              <b>Stage 실행</b>
              <ul>
                <li><b>Plan/Exec/Verify/Review/Fix Loop</b> 버튼은 해당 역할 pane으로 템플릿 프롬프트를 전송합니다.</li>
                <li>pane에 codex가 이미 실행 중이면 프롬프트만 보내고, 아니면 codex 실행까지 래핑해서 동작합니다.</li>
              </ul>
            </li>
            <li>
              <b>Orchestrator(연쇄 실행)</b>
              <ul>
                <li><b>manual</b>: 단계별로 전송 후 <b>Approve Next</b>로 다음 단계 진행</li>
                <li><b>auto</b>: 제한적으로 PASS/FAIL, approve/hold 같은 신호를 감지해서 다음 진행을 자동화</li>
              </ul>
            </li>
            <li>
              <b>로그 도구</b>
              <ul>
                <li><b>search/regex/Aa</b>: 원하는 부분만 빠르게 좁히기</li>
                <li><b>copy</b>: 필터된 로그를 그대로 복사</li>
                <li><b>expand</b>: 큰 화면으로 보기</li>
              </ul>
            </li>
          </ol>

          <h3 style={{ marginTop: 16, fontWeight: 900, color: '#e5e7eb' }}>운영 팁</h3>
          <ul>
            <li>tmux pane이 섞였다고 느껴지면 Task Detail의 <b>Sync pane titles</b>로 역할명을 다시 맞추세요.</li>
            <li>문제가 생기면 먼저 Task Detail에서 어떤 역할에서 에러가 났는지(architect/executor/qa/reviewer)부터 좁히는 게 제일 빠릅니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
