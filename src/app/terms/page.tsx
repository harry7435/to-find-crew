import type { Metadata } from 'next';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: '서비스 이용약관 | To Find Crew',
  description: 'To Find Crew 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <LegalLayout title="서비스 이용약관" effectiveDate="2026년 8월 14일">
      <LegalSection heading="제1조 (목적)">
        <p>
          이 약관은 To Find Crew(이하 &ldquo;서비스&rdquo;)가 제공하는 배드민턴 모임 및 경기 운영 관련 서비스의 이용
          조건과 절차, 이용자와 운영자의 권리·의무 및 책임 사항을 규정하는 것을 목적으로 합니다.
        </p>
      </LegalSection>

      <LegalSection heading="제2조 (용어의 정의)">
        <ul className="list-disc space-y-1 pl-5">
          <li>&ldquo;이용자&rdquo;란 이 약관에 따라 서비스를 이용하는 모든 사람을 말합니다.</li>
          <li>&ldquo;회원&rdquo;이란 구글·카카오·이메일 계정으로 로그인한 이용자를 말합니다.</li>
          <li>&ldquo;게스트&rdquo;란 로그인하지 않고 서비스를 이용하는 이용자를 말합니다.</li>
          <li>&ldquo;모임&rdquo;이란 회원이 서비스 내에 생성한 배드민턴 운동 일정 단위를 말합니다.</li>
          <li>
            &ldquo;운영진&rdquo;이란 모임을 생성한 회원으로서 참가자 명단과 경기 진행을 관리하는 이용자를 말합니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="제3조 (약관의 게시와 개정)">
        <p>
          운영자는 이 약관을 서비스 화면에 게시합니다. 운영자는 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수
          있으며, 개정 시 시행일 7일 전부터 서비스 내 공지를 통해 안내합니다. 이용자에게 불리한 변경의 경우 최소 30일
          전에 안내하며, 이용자가 개정 약관에 동의하지 않는 경우 이용을 중단하고 탈퇴할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제4조 (서비스의 내용)">
        <p>서비스는 다음 기능을 제공합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>배드민턴 모임 생성·수정·삭제 및 초대 링크를 통한 참가자 모집</li>
          <li>참가자 명단 관리, 팀 편성, 코트 배정, 대기 순서 및 경기 기록 관리</li>
          <li>로그인 없이 이용할 수 있는 게임 관리 기능(브라우저 저장 방식)</li>
          <li>랜덤 뽑기 등 부가 기능</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제5조 (회원 가입 및 계정)">
        <p>
          이용자는 구글·카카오 계정 또는 이메일 인증을 통해 회원으로 가입할 수 있습니다. 회원은 자신의 계정을 제3자에게
          양도하거나 대여할 수 없으며, 계정 관리 소홀로 발생한 문제에 대한 책임은 회원 본인에게 있습니다. 회원은
          언제든지 탈퇴를 요청할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제6조 (이용 요금)">
        <p>
          서비스는 현재 무료로 제공됩니다. 향후 유료 기능이 도입되는 경우, 운영자는 시행 전에 그 내용과 조건을 별도로
          안내하며 이용자의 동의 없이 요금을 부과하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제7조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>타인의 개인정보를 본인의 동의 없이 입력하거나 도용하는 행위</li>
          <li>타인을 모욕하거나 불쾌감을 주는 명칭·닉네임을 입력하는 행위</li>
          <li>서비스의 정상적인 운영을 방해하거나 자동화된 수단으로 부당하게 접근하는 행위</li>
          <li>초대 링크나 참가 코드를 권한 없는 제3자에게 무단으로 유포하는 행위</li>
          <li>관련 법령 또는 이 약관에 위배되는 행위</li>
        </ul>
        <p className="mt-2">
          특히 운영진이 참가자를 대신하여 이름·성별·급수·연령대를 입력하는 경우, 해당 참가자 본인의 동의를 확보할 책임은
          입력한 운영진에게 있습니다. 참가자 본인이 정보의 수정·삭제를 요청하면 운영진은 지체 없이 이에 응해야 합니다.
        </p>
      </LegalSection>

      <LegalSection heading="제8조 (데이터의 관리와 소멸)">
        <ul className="list-disc space-y-1 pl-5">
          <li>모임이 삭제되면 해당 모임의 참가자 명단과 경기 기록도 함께 삭제되며 복구할 수 없습니다.</li>
          <li>
            로그인 없이 이용하는 게임 관리 기능의 데이터는 이용자의 브라우저에만 저장됩니다. 브라우저 저장 데이터 삭제,
            시크릿 모드 종료, 기기 변경 등의 사유로 소멸할 수 있으며 운영자는 이를 복구할 수 없습니다.
          </li>
          <li>게스트의 즐겨찾기 목록 역시 브라우저에만 저장되므로 기기·브라우저 간에 공유되지 않습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제9조 (서비스 제공의 중단)">
        <p>
          운영자는 시스템 점검·교체, 통신 장애, 천재지변, 외부 서비스(호스팅·데이터베이스·로그인 제공자)의 장애 등
          불가피한 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있습니다. 이 경우 사전 공지를 원칙으로 하되,
          긴급한 사유가 있는 때에는 사후에 안내할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제10조 (면책)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스는 모임 운영을 돕는 도구를 제공할 뿐이며, 오프라인 모임에서 발생하는 부상·분실·이용자 간 분쟁 등에
            대해서는 책임을 지지 않습니다.
          </li>
          <li>이용자가 입력한 정보의 정확성, 참가자 간의 약속 이행에 대해서는 해당 이용자가 책임을 부담합니다.</li>
          <li>
            운영자는 무료로 제공되는 서비스의 이용과 관련하여, 운영자의 고의 또는 중대한 과실이 없는 한 데이터 유실이나
            서비스 중단으로 인한 손해에 대해 책임을 지지 않습니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="제11조 (저작권)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스의 화면 구성, 디자인, 소스 코드, 상표 및 로고 등 서비스를 구성하는 일체의 저작물에 대한 권리는
            운영자에게 있습니다. 이용자는 운영자의 사전 동의 없이 이를 복제·배포·전송·전시하거나 2차적 저작물로 이용할
            수 없습니다.
          </li>
          <li>
            이용자가 서비스에 입력한 모임명·닉네임 등 콘텐츠의 권리는 해당 이용자에게 있으며, 운영자는 서비스 제공에
            필요한 범위에서만 이를 저장·표시합니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="제12조 (이용 제한)">
        <p>
          운영자는 이용자가 제7조의 의무를 위반한 경우 사전 통지 후 서비스 이용을 제한하거나 계정을 정지할 수 있습니다.
          다만 긴급하게 조치할 필요가 있는 경우에는 조치 후 통지할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제13조 (준거법 및 관할)">
        <p>
          이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우 운영자와 이용자는 성실히
          협의하여 해결합니다. 협의가 이루어지지 않을 경우 민사소송법에 따른 관할 법원에 소를 제기할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="문의">
        <p>서비스 이용에 관한 문의는 서비스 상단의 &ldquo;문의하기&rdquo;를 통해 접수해 주시기 바랍니다.</p>
      </LegalSection>
    </LegalLayout>
  );
}
