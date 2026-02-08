import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 bg-gradient-to-r from-blue-50 to-green-50">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-16 pb-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">To Find Crew 🏸</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            관심사가 비슷한 사람들과 크루를 만들고
            <br />
            번개 모임을 운영해보세요
          </p>
          {/* <div className="flex gap-4 justify-center">
          <Button size="lg">크루 찾기</Button>
          <Button variant="outline" size="lg">
            크루 만들기
          </Button>
        </div> */}
        </section>

        {/* Badminton Section */}
        <section className="container mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-xl">번개 생성</CardTitle>
                <CardDescription>번개를 만들어 관리해요</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/badminton/create" className="cursor-pointer">
                  <Button className="w-full">생성</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-xl">번개 참가</CardTitle>
                <CardDescription>코드를 입력해서 번개에 참여해요</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/badminton/join" className="cursor-pointer">
                  <Button variant="outline" className="w-full">
                    번개 참여
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-xl">게임 관리</CardTitle>
                <CardDescription>선수 등록과 랜덤 팀 뽑기</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/game-manager" className="cursor-pointer">
                  <Button variant="outline" className="w-full">
                    관리하기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                ✨ <strong>특징:</strong> 자동 팀 배정, 코트 관리, 공정한 게임 추적
              </p>
              <p>
                🎮 <strong>시스템:</strong> 성별과 실력을 고려한 밸런스 있는 팀 구성
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
