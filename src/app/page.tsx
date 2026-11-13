import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

// AppShell이 세로 flex로 감싸므로 min-h-screen 대신 flex-1로 남은 높이를 채운다.
// (min-h-screen을 쓰면 헤더 패딩 + 푸터 높이만큼 넘쳐 불필요한 스크롤이 생긴다)
export default function Home() {
  return (
    <main className="flex-1 bg-gradient-to-r from-blue-50 to-green-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-10 pb-4 text-center">
        <p className="text-sm font-semibold text-muted-foreground mb-2">To Find Crew 🏸</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
          배드민턴 모임,
          <br className="sm:hidden" /> 코트·게임 관리를 한 번에
        </h1>
        {/* 크루 매칭은 장기 비전이라 문구를 지우지 않고 남겨 둔다(CLAUDE.md Project Identity).
        <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
          관심사가 비슷한 사람들과 크루를 만들고
          <br />
          번개 모임을 운영해보세요
        </p> */}
        {/* <div className="flex gap-4 justify-center">
          <Button size="lg">크루 찾기</Button>
          <Button variant="outline" size="lg">
            크루 만들기
          </Button>
        </div> */}
      </section>

      {/* 역할별 입구 — 처음 온 사람이 "나는 운영진인가 참여자인가"만 고르면 되게 한다 */}
      <section className="container mx-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link
            href="/badminton/my-sessions"
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full border-blue-200 transition-shadow group-hover:shadow-md">
              <CardHeader>
                <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  운영진
                </span>
                <CardTitle className="flex items-center justify-between text-xl">
                  모임 운영하기
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>모임을 만들고 코트·게임을 배정해요</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link
            href="/badminton/join"
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full border-green-200 transition-shadow group-hover:shadow-md">
              <CardHeader>
                <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  참여자
                </span>
                <CardTitle className="flex items-center justify-between text-xl">
                  코드로 참여하기
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>운영진에게 받은 4자리 코드를 입력해요</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* 보조 기능 — 공유 보드(위)와 다른, 이 기기 전용 기능이라 구분선 아래 덜 눈에 띄게 둔다 */}
        <div className="max-w-2xl mx-auto mt-8 border-t border-gray-200 pt-6">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Link href="/game-manager">
                <Button variant="outline" className="w-full whitespace-normal break-keep h-auto min-h-11 py-2">
                  로그인 없이 체험해보기
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center">이 기기에만 저장돼요</p>
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/random-picker">
                <Button variant="outline" className="w-full h-auto min-h-11">
                  랜덤 뽑기
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center">손가락으로 당첨자를 뽑아요</p>
            </div>
          </div>
        </div>

        {/* <div className="mt-8 text-center">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                ✨ <strong>특징:</strong> 자동 팀 배정, 코트 관리, 공정한 게임 추적
              </p>
              <p>
                🎮 <strong>시스템:</strong> 성별과 실력을 고려한 밸런스 있는 팀 구성
              </p>
            </div>
          </div> */}
      </section>
    </main>
  );
}
