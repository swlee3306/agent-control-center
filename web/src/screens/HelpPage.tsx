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
        <div className="mono" style={{ marginTop: 10, color: '#a1a1aa', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>1) 이 앱이 하는 일</div>
          <ul>
            <li>tmux 세션(codex-pool)의 각 pane(architect/executor/qa/reviewer)을 웹에서 관찰/제어합니다.</li>
            <li>명령/프롬프트는 tmux로 전송(send-keys)되고, 로그는 tmux capture-pane으로 읽어옵니다.</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>2) 작업(Task) 생성</div>
          <ul>
            <li>Dashboard에서 <b>new_task</b> 버튼 → summary 입력 → Task 상세 화면으로 이동</li>
            <li>Task는 저장소(/data/acc-store.json)에 저장되어 재시작해도 유지됩니다.</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>3) Stage 실행</div>
          <ul>
            <li><b>Run Plan/Exec/Verify/Review/Fix Loop</b>: 해당 역할 pane으로 템플릿 프롬프트를 전송합니다.</li>
            <li>pane에 codex가 이미 실행 중이면 프롬프트만 보내고, 아니면 codex --yolo로 실행합니다.</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>4) Orchestrator(연쇄 실행)</div>
          <ul>
            <li><b>Start Orchestrator (manual)</b>: 단계별로 전송 후, <b>Approve Next</b>로 다음 단계 진행</li>
            <li><b>Start Orchestrator (auto)</b>: Verify/Review는 PASS/FAIL, approve/hold를 간단 감지해 자동 진행(안전하게 제한적)</li>
            <li><b>Stop Orchestrator</b>: 오케스트레이터 중단</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>5) 로그 보기</div>
          <ul>
            <li>각 역할 카드 하단에서 live log를 확인합니다.</li>
            <li><b>search</b>: 표시 중인 로그 내 포함 검색(하이라이트 지원)</li>
            <li><b>auto-scroll</b>: 최신 로그로 자동 스크롤</li>
            <li><b>copy</b>: 현재 표시 중인(필터된) 로그 복사</li>
            <li><b>expand</b>: 해당 로그를 큰 화면(모달)로 보기</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>6) Dashboard에서 종료/삭제</div>
          <ul>
            <li><b>terminate</b>: 오케스트레이터가 있으면 중단하고 task 상태를 terminated로 표시(soft 종료)</li>
            <li><b>delete</b>: task를 저장소에서 완전 삭제(복구 불가)</li>
          </ul>

          <div style={{ fontWeight: 900, color: '#e5e7eb' }}>Tip</div>
          <ul>
            <li>tmux pane이 섞였다고 느껴지면 Task Detail의 <b>Sync pane titles</b> 버튼을 눌러 역할명을 고정하세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
