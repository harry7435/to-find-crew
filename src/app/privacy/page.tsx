import type { Metadata } from 'next';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: '개인정보처리방침 | To Find Crew',
  description: 'To Find Crew 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="개인정보처리방침" effectiveDate="2026년 8월 14일">
      <p>
        To Find Crew(이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 이와 관련한
        고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <LegalSection heading="1. 수집하는 개인정보 항목 및 수집 방법">
        <p className="font-medium text-gray-900">가. 회원 가입 시 (소셜 로그인 · 이메일 로그인)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>필수: 이메일 주소, 이름(또는 닉네임), 로그인 제공자 구분(구글 / 카카오 / 이메일)</li>
          <li>선택: 프로필 이미지, 자기소개, 성별, 배드민턴 급수, 휴대전화번호</li>
        </ul>
        <p className="mt-2">
          구글·카카오 계정으로 로그인하는 경우, 해당 사업자로부터 이용자가 동의한 범위의 정보(이메일, 이름 또는 닉네임,
          프로필 이미지)를 전달받습니다.
        </p>

        <p className="mt-4 font-medium text-gray-900">나. 서비스 이용 과정에서 생성·입력되는 정보</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>모임 정보: 모임명, 체육관·장소명, 모임 일시, 코트 수, 최대 인원, 참가 코드</li>
          <li>참가 및 경기 기록: 참가 일시, 경기 수, 팀 구성, 대기 시간, 경기 결과</li>
        </ul>

        <p className="mt-4 font-medium text-gray-900">다. 모임 운영진이 다른 참가자를 대신하여 입력하는 정보</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>이름(또는 닉네임), 성별, 배드민턴 급수, 연령대</li>
        </ul>
        <p className="mt-2">
          모임 운영진은 로그인하지 않은 참가자를 명단에 추가하거나, 로그인 참가자의 해당 모임 내 표시 정보를 수정할 수
          있습니다. 이 경우 입력되는 정보는 <span className="font-medium">해당 모임의 경기 진행 목적</span>으로만
          사용되며, 정보 주체 본인의 동의를 확보할 책임은 정보를 입력한 운영진에게 있습니다(자세한 내용은 아래 6항
          참조).
        </p>

        <p className="mt-4 font-medium text-gray-900">라. 자동으로 수집되는 정보</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스 이용 통계(방문 페이지, 접속 국가·기기 유형 등) — 개인을 식별하지 않는 익명 집계 형태</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 개인정보의 수집 및 이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 식별 및 로그인 인증, 계정 관리</li>
          <li>모임 생성·참가 관리 및 참가자 명단 구성</li>
          <li>팀 편성, 코트 배정, 대기 순서 관리 등 경기 운영 기능 제공</li>
          <li>같은 모임에 참가한 이용자 간 참가자 정보 표시</li>
          <li>서비스 개선을 위한 이용 통계 분석</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 개인정보의 보유 및 이용 기간">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 정보: 회원 탈퇴 시까지 보유하며, 탈퇴 요청 시 지체 없이 파기합니다.</li>
          <li>
            모임·참가자·경기 기록: 해당 모임이 삭제될 때 함께 삭제되며, 회원 탈퇴 시 그 회원이 생성한 모임과 참가 기록도
            함께 삭제됩니다.
          </li>
          <li>
            로그인 없이 이용하는 &ldquo;게임 관리&rdquo; 기능에 입력한 정보: 서버에 전송되지 않고 이용자의 브라우저에만
            저장되므로, 브라우저 저장 데이터를 삭제하면 즉시 소멸합니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 개인정보의 제3자 제공">
        <p>
          서비스는 이용자의 개인정보를 외부에 판매하거나 제3자에게 제공하지 않습니다. 다만 서비스의 본질적인 기능상,
          <span className="font-medium">
            {' '}
            같은 모임에 참가한 다른 이용자에게는 참가자의 이름(또는 닉네임), 성별, 급수, 연령대, 경기 기록이 화면에
            표시됩니다.
          </span>{' '}
          이는 팀 편성과 경기 운영을 위해 필요한 범위로 한정됩니다.
        </p>
      </LegalSection>

      <LegalSection heading="5. 개인정보 처리의 위탁">
        <p>서비스는 원활한 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="px-3 py-2 font-medium">수탁자</th>
                <th className="px-3 py-2 font-medium">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-3 py-2">Supabase Inc.</td>
                <td className="px-3 py-2">데이터베이스 저장·관리, 로그인 인증</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2">Vercel Inc.</td>
                <td className="px-3 py-2">서비스 호스팅, 익명 방문 통계 수집</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2">Google LLC</td>
                <td className="px-3 py-2">구글 계정 로그인 인증</td>
              </tr>
              <tr>
                <td className="px-3 py-2">주식회사 카카오</td>
                <td className="px-3 py-2">카카오 계정 로그인 인증</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2">
          위 수탁자 중 일부는 국외(미국)에 서버를 두고 있으며, 위탁 목적 달성에 필요한 범위 내에서만 개인정보를
          처리합니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 다른 사람의 정보를 입력하는 이용자의 책임">
        <p>
          모임 운영진이 참가자를 대신하여 이름·성별·급수·연령대를 입력하는 경우, 해당 정보의 정확성과 정보 주체 본인의
          동의 확보에 대한 책임은 정보를 입력한 이용자에게 있습니다. 본인의 동의 없이 타인의 개인정보를 입력해서는 안
          되며, 참가자 본인이 삭제·수정을 요청하는 경우 운영진은 지체 없이 이에 응해야 합니다.
        </p>
      </LegalSection>

      <LegalSection heading="7. 브라우저 저장소(로컬 스토리지)의 이용">
        <p>서비스는 아래 목적으로 이용자의 브라우저 저장소를 사용합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>로그인 없이 이용하는 &ldquo;게임 관리&rdquo; 기능의 참가자 명단, 코트 상태, 경기 기록 임시 저장</li>
          <li>로그인하지 않은 이용자가 참가한 모임을 다시 찾아갈 수 있도록 하는 즐겨찾기 목록</li>
          <li>로그인 세션 유지</li>
        </ul>
        <p className="mt-2">
          이 정보는 서버로 전송되지 않으며, 브라우저 설정에서 사이트 데이터를 삭제하면 함께 삭제됩니다. 다만 삭제 시
          저장된 게임 관리 데이터와 즐겨찾기 목록은 복구할 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection heading="8. 이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다. 프로필 정보는 로그인 후
          프로필 페이지에서 직접 확인·수정할 수 있으며, 계정 삭제나 그 밖의 요청은 아래 연락처로 문의해 주시기 바랍니다.
          만 14세 미만 아동의 개인정보는 법정대리인의 동의 없이 수집하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="9. 개인정보의 파기">
        <p>
          보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일 형태의 정보는 복구할 수
          없는 기술적 방법으로 삭제합니다.
        </p>
      </LegalSection>

      <LegalSection heading="10. 개인정보의 안전성 확보 조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>데이터베이스 접근 권한 제어(Row Level Security)를 통한 접근 제한</li>
          <li>전송 구간 암호화(HTTPS) 적용</li>
          <li>개인정보 취급자 최소화</li>
        </ul>
      </LegalSection>

      <LegalSection heading="11. 개인정보 보호책임자 및 문의처">
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보 보호책임자: 조익준 </li>
          <li>문의 경로: 오른쪽 상단 문의하기 버튼 클릭</li>
        </ul>
        <p className="mt-2">
          개인정보 침해에 대한 신고·상담이 필요한 경우 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보
          분쟁조정위원회(kopico.go.kr, 1833-6972)에 문의하실 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="12. 개인정보처리방침의 변경">
        <p>
          이 방침의 내용에 추가·삭제·수정이 있을 경우 시행 7일 전부터 서비스 내 공지를 통해 안내합니다. 다만 이용자
          권리에 중대한 변경이 발생하는 경우에는 최소 30일 전에 안내합니다.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
