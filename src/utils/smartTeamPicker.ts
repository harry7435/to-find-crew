import { Player, GameRecord } from '@/hooks/useGameManager';

interface PlayerWithStats {
  player: Player;
  gameCount: number;
  partners: Set<string>; // IDs of players they've played with
}

interface TeamPair {
  teamA: [Player, Player];
  teamB: [Player, Player];
  score: number; // Lower is better
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 두 선수가 함께 게임한 횟수 계산
function getPartnerCount(playerId1: string, playerId2: string, games: GameRecord[]): number {
  let count = 0;
  games.forEach((game) => {
    const teamA = game.teamA;
    const teamB = game.teamB;

    if (
      (teamA[0] === playerId1 && teamA[1] === playerId2) ||
      (teamA[1] === playerId1 && teamA[0] === playerId2) ||
      (teamB[0] === playerId1 && teamB[1] === playerId2) ||
      (teamB[1] === playerId1 && teamB[0] === playerId2)
    ) {
      count++;
    }
  });
  return count;
}

// 선수별 통계 생성
function getPlayerStats(players: Player[], games: GameRecord[]): Map<string, PlayerWithStats> {
  const statsMap = new Map<string, PlayerWithStats>();

  players.forEach((player) => {
    const gameCount = games.filter((game) => game.teamA.includes(player.id) || game.teamB.includes(player.id)).length;

    const partners = new Set<string>();
    games.forEach((game) => {
      if (game.teamA[0] === player.id) partners.add(game.teamA[1]);
      if (game.teamA[1] === player.id) partners.add(game.teamA[0]);
      if (game.teamB[0] === player.id) partners.add(game.teamB[1]);
      if (game.teamB[1] === player.id) partners.add(game.teamB[0]);
    });

    statsMap.set(player.id, {
      player,
      gameCount,
      partners,
    });
  });

  return statsMap;
}

// 팀 조합의 점수 계산 (낮을수록 좋음)
function calculateTeamScore(
  teamA: [Player, Player],
  teamB: [Player, Player],
  statsMap: Map<string, PlayerWithStats>,
  games: GameRecord[],
): number {
  let score = 0;

  // 1. 게임 수 편차 (게임을 적게 한 선수들이 우선)
  const gameCounts = [teamA[0], teamA[1], teamB[0], teamB[1]].map((p) => statsMap.get(p.id)?.gameCount || 0);
  const avgGames = gameCounts.reduce((a, b) => a + b, 0) / 4;
  const gameVariance = gameCounts.reduce((sum, count) => sum + Math.pow(count - avgGames, 2), 0);
  score += gameVariance * 10; // 게임 수 편차에 높은 가중치

  // 2. 파트너 중복 페널티 (같이 플레이한 적 있으면 높은 점수)
  const partnerPenalty = (p1: Player, p2: Player) => {
    const count = getPartnerCount(p1.id, p2.id, games);
    return count * count * 50; // 제곱으로 페널티 증가
  };

  score += partnerPenalty(teamA[0], teamA[1]); // Team A 페어
  score += partnerPenalty(teamB[0], teamB[1]); // Team B 페어

  // 3. 대전 상대 중복 페널티 (맞상대로 플레이한 적 있으면 페널티)
  games.forEach((game) => {
    const aIds = [teamA[0].id, teamA[1].id];
    const bIds = [teamB[0].id, teamB[1].id];

    const isExactMatch =
      (game.teamA.every((id) => aIds.includes(id)) && game.teamB.every((id) => bIds.includes(id))) ||
      (game.teamA.every((id) => bIds.includes(id)) && game.teamB.every((id) => aIds.includes(id)));

    if (isExactMatch) {
      score += 100; // 정확히 같은 매치업이면 큰 페널티
    }
  });

  return score;
}

// 스마트 팀 매칭
export function smartTeamPicker(
  players: Player[],
  games: GameRecord[],
): { teamA: [Player, Player]; teamB: [Player, Player] } {
  // 활성 상태인 선수만 필터링
  const activePlayers = players.filter((p) => p.status === 'active');

  if (activePlayers.length < 4) {
    throw new Error('최소 4명의 활성 선수가 필요합니다');
  }

  const statsMap = getPlayerStats(activePlayers, games);

  // 게임 수가 적은 선수들에게 우선순위 부여
  const sortedByGames = [...activePlayers].sort((a, b) => {
    const aGames = statsMap.get(a.id)?.gameCount || 0;
    const bGames = statsMap.get(b.id)?.gameCount || 0;
    return aGames - bGames;
  });

  // 여러 조합 생성 및 평가
  const candidates: TeamPair[] = [];
  const numAttempts = Math.min(50, activePlayers.length * 2); // 최대 50개 조합 시도

  for (let i = 0; i < numAttempts; i++) {
    // 랜덤 셔플 (게임 수 적은 선수 우선 고려)
    let shuffled: Player[];
    if (i < 10) {
      // 처음 10개는 게임 수 적은 순서 기반
      shuffled = [...sortedByGames];
      if (i > 0) {
        // 약간의 랜덤성 추가
        for (let j = 4; j < shuffled.length; j++) {
          const randomIndex = 4 + Math.floor(Math.random() * (shuffled.length - 4));
          [shuffled[j], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[j]];
        }
      }
    } else {
      // 나머지는 완전 랜덤
      shuffled = shuffleArray(activePlayers);
    }

    const teamA: [Player, Player] = [shuffled[0], shuffled[1]];
    const teamB: [Player, Player] = [shuffled[2], shuffled[3]];

    const score = calculateTeamScore(teamA, teamB, statsMap, games);

    candidates.push({ teamA, teamB, score });
  }

  // 점수가 가장 낮은 조합 선택
  candidates.sort((a, b) => a.score - b.score);

  return {
    teamA: candidates[0].teamA,
    teamB: candidates[0].teamB,
  };
}

// 단순 랜덤 매칭 (4명 뽑기)
export function randomTeamPicker(players: Player[]): [Player, Player, Player, Player] {
  const activePlayers = players.filter((p) => p.status === 'active');
  const pinnedPlayers = activePlayers.filter((p) => p.pinned === true);
  const unpinnedPlayers = activePlayers.filter((p) => !p.pinned);

  // 필수 포함 선수가 4명을 초과하면 에러
  if (pinnedPlayers.length > 4) {
    throw new Error('필수 포함 선수는 최대 4명까지 가능합니다');
  }

  // 전체 활성 선수가 4명 미만이면 에러
  if (activePlayers.length < 4) {
    throw new Error('최소 4명의 활성 선수가 필요합니다');
  }

  // 필수 포함 선수를 먼저 배치하고, 부족한 인원은 일반 선수에서 랜덤 선택
  const neededCount = 4 - pinnedPlayers.length;
  const shuffledUnpinned = shuffleArray(unpinnedPlayers);
  const selectedPlayers = [...pinnedPlayers, ...shuffledUnpinned.slice(0, neededCount)];

  // 최종 4명을 다시 셔플
  const finalShuffle = shuffleArray(selectedPlayers);

  return [finalShuffle[0], finalShuffle[1], finalShuffle[2], finalShuffle[3]] as [Player, Player, Player, Player];
}
