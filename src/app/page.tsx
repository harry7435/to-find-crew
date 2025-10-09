import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-16 pb-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">To Find Crew 🚀</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            관심사가 비슷한 사람들과 크루를 만들고
            <br />
            모임을 주선할 수 있는 플랫폼
          </p>
          {/* <div className="flex gap-4 justify-center">
          <Button size="lg">크루 찾기</Button>
          <Button variant="outline" size="lg">
            크루 만들기
          </Button>
        </div> */}
        </section>

        {/* Badminton Section */}
        <section className="container mx-auto px-4 py-16 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">🏸 배드민턴 번개 모임</h2>
            <p className="text-lg text-muted-foreground">배드민턴 번개를 만들거나 참여할 수 있어요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-xl">번개 생성</CardTitle>
                <CardDescription>번개를 만들어 관리해요</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/badminton/create">
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
                <Link href="/badminton/join">
                  <Button variant="outline" className="w-full">
                    번개 참여
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

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">주요 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">👥 크루 관리</CardTitle>
                <CardDescription>관심사별로 크루를 생성하고 멤버를 관리하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  운동, 스터디, 취미 등 다양한 카테고리의 크루를 만들고 참여할수 있습니다.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">📅 모임 관리</CardTitle>
                <CardDescription>크루원들과 함께 모임을 계획하고 참여하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  일정 조율부터 장소 예약까지, 모임의 모든 것을 한 곳에서 관리하세요.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">💬 실시간 채팅</CardTitle>
                <CardDescription>크루원들과 실시간으로 소통하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">크루별 채팅방에서 정보를 공유하고 친목을 다져보세요.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">지금 시작하세요!</CardTitle>
              <CardDescription>새로운 사람들을 만나고 즐거운 활동을 함께 해보세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full sm:w-auto">
                회원가입하기
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
