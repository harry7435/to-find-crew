'use client';

import { useMemo } from 'react';
import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star } from 'lucide-react';

// ─── 고정 레이아웃 상수 ───────────────────────────────────────────
const CARD_W = 112; // 카드 너비 (px)
const CARD_H = 84; // 카드 높이 (px)
const H_GAP = 60; // 카드 가로 간격
const V_GAP = 48; // 카드 세로 간격

const SVG_W = CARD_W * 2 + H_GAP; // 284
const SVG_H = CARD_H * 2 + V_GAP; // 216

// 카드 중심 좌표
const CX0 = CARD_W / 2; // 56  (좌)
const CX1 = CARD_W + H_GAP + CARD_W / 2; // 228 (우)
const CY0 = CARD_H / 2; // 42  (상)
const CY1 = CARD_H + V_GAP + CARD_H / 2; // 174 (하)

// ─── 각 엣지의 선 좌표 (카드 경계 ↔ 카드 경계) ──────────────────
const EDGE_TOP = { x1: CARD_W, y1: CY0, x2: CARD_W + H_GAP, y2: CY0 }; // P0-P1 가로
const EDGE_BOTTOM = { x1: CARD_W, y1: CY1, x2: CARD_W + H_GAP, y2: CY1 }; // P2-P3 가로
const EDGE_LEFT = { x1: CX0, y1: CARD_H, x2: CX0, y2: CARD_H + V_GAP }; // P0-P2 세로
const EDGE_RIGHT = { x1: CX1, y1: CARD_H, x2: CX1, y2: CARD_H + V_GAP }; // P1-P3 세로
// 대각선: 카드 모서리에서 12px 내부에서 시작해 카드 뒤에 선이 묻히는 것 방지
const DIAG_INSET = 14;
const EDGE_DIAG_A = { x1: CX0 + DIAG_INSET, y1: CY0 + DIAG_INSET, x2: CX1 - DIAG_INSET, y2: CY1 - DIAG_INSET }; // P0-P3
const EDGE_DIAG_B = { x1: CX1 - DIAG_INSET, y1: CY0 + DIAG_INSET, x2: CX0 + DIAG_INSET, y2: CY1 - DIAG_INSET }; // P1-P2

// ─── 라벨 위치 ────────────────────────────────────────────────────
const LBL_TOP = { x: SVG_W / 2, y: CY0 - 14 }; // 선(y=42)과 겹치지 않게 위로
const LBL_BOTTOM = { x: SVG_W / 2, y: CY1 + 16 };
const LBL_LEFT = { x: CX0 - 20, y: (CARD_H + CARD_H + V_GAP) / 2 };
const LBL_RIGHT = { x: CX1 + 20, y: (CARD_H + CARD_H + V_GAP) / 2 };
// 대각선 라벨: 각 대각선의 시작 카드(P0, P1) 바로 아래 – 어느 카드에서 시작하는 선인지 명확하게
const LBL_DIAG_A = { x: CARD_W - 8, y: CARD_H + 12 }; // P0 우하단 → (104, 96)
const LBL_DIAG_B = { x: CARD_W + H_GAP + 8, y: CARD_H + 12 }; // P1 좌하단 → (180, 96)

// ─── 타입 정의 ───────────────────────────────────────────────────
interface TeamPickerProps {
  players: Player[];
  games: GameRecord[];
  pickedPlayers: [Player, Player, Player, Player] | null;
  onRandomPick: () => void;
  onConfirm: () => void;
  onReject: () => void;
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function getSkillLevelColor(level: string): string {
  switch (level) {
    case 'S':
      return 'bg-red-100 text-red-800';
    case 'A':
      return 'bg-orange-100 text-orange-800';
    case 'B':
      return 'bg-yellow-100 text-yellow-800';
    case 'C':
      return 'bg-blue-100 text-blue-800';
    case 'D':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getGenderIcon(gender?: 'male' | 'female'): string {
  if (!gender) return '👤';
  return gender === 'male' ? '♂️' : '♀️';
}

// ─── 선수 카드 (고정 크기) ────────────────────────────────────────
function PlayerCard({ player, gameCount }: { player: Player; gameCount: number }) {
  return (
    <div
      className="relative z-10 border rounded-lg bg-white flex flex-col items-center justify-center gap-0.5 p-2 text-center overflow-hidden"
      style={{ width: CARD_W, height: CARD_H }}
    >
      <div className="text-sm leading-none">
        {getGenderIcon(player.gender)} <span className="font-semibold text-sm">{player.name}</span>
      </div>
      <div className="flex items-center gap-0.5 text-xs text-gray-500">
        <Trophy className="h-3 w-3 shrink-0" />
        <span>{gameCount}게임</span>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {player.pinned && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-300 leading-4"
          >
            <Star className="h-2.5 w-2.5 mr-0.5 fill-yellow-400" />
            필수
          </Badge>
        )}
        {player.skillLevel && (
          <Badge className={`text-[10px] px-1.5 py-0 leading-4 ${getSkillLevelColor(player.skillLevel)}`}>
            {player.skillLevel}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── 공동 게임 횟수 → 색상 ────────────────────────────────────────
function getCoPlayColors(count: number): { fill: string; stroke: string } {
  if (count === 0) return { fill: '#16a34a', stroke: '#bbf7d0' }; // green  – 첫조합
  if (count <= 2) return { fill: '#6b7280', stroke: '#e5e7eb' }; // gray   – 1~2회
  if (count <= 4) return { fill: '#d97706', stroke: '#fde68a' }; // amber  – 3~4회
  return { fill: '#dc2626', stroke: '#fecaca' }; // red    – 5회+
}

// ─── SVG 엣지 라벨 ───────────────────────────────────────────────
function EdgeLabel({ x, y, count }: { x: number; y: number; count: number }) {
  const label = count === 0 ? '첫조합' : `${count}회`;
  const { fill, stroke: bgStroke } = getCoPlayColors(count);
  const bgW = count === 0 ? 38 : 22;

  return (
    <>
      <rect x={x - bgW / 2} y={y - 9} width={bgW} height={18} rx={9} fill="white" stroke={bgStroke} strokeWidth={1} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill={fill}
        fontWeight={count === 0 ? 600 : 500}
      >
        {label}
      </text>
    </>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function TeamPicker({
  players,
  games,
  pickedPlayers,
  onRandomPick,
  onConfirm,
  onReject,
}: TeamPickerProps) {
  const activePlayers = players.filter((p) => p.status === 'active');
  const canPick = activePlayers.length >= 4;

  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => game.players.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    return counts;
  }, [games]);

  const coPlay = useMemo(
    () => (id1: string, id2: string) => games.filter((g) => g.players.includes(id1) && g.players.includes(id2)).length,
    [games],
  );

  if (!pickedPlayers) {
    return (
      <div className="text-center space-y-4">
        <Button onClick={onRandomPick} disabled={!canPick} size="lg" className="w-full md:w-auto">
          랜덤 뽑기 🎲
        </Button>
        {!canPick && (
          <p className="text-sm text-gray-500">최소 4명의 활성 선수가 필요합니다 (현재: {activePlayers.length}명)</p>
        )}
      </div>
    );
  }

  const [p0, p1, p2, p3] = pickedPlayers;
  const gc = (p: Player) => playerGameCounts.get(p.id) || 0;

  const c01 = coPlay(p0.id, p1.id);
  const c23 = coPlay(p2.id, p3.id);
  const c02 = coPlay(p0.id, p2.id);
  const c13 = coPlay(p1.id, p3.id);
  const c03 = coPlay(p0.id, p3.id); // 대각선
  const c12 = coPlay(p1.id, p2.id); // 대각선

  return (
    <AnimatePresence>
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* 고정 크기 컨테이너 – 가운데 정렬 */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: SVG_W, height: SVG_H }}>
              {/* SVG 선 레이어 (카드 뒤) */}
              <svg className="absolute inset-0" width={SVG_W} height={SVG_H} style={{ zIndex: 0 }}>
                {/* 4개 엣지 선 */}
                <line {...EDGE_TOP} stroke="#d1d5db" strokeWidth={1.5} />
                <line {...EDGE_BOTTOM} stroke="#d1d5db" strokeWidth={1.5} />
                <line {...EDGE_LEFT} stroke="#d1d5db" strokeWidth={1.5} />
                <line {...EDGE_RIGHT} stroke="#d1d5db" strokeWidth={1.5} />
                {/* 대각선 */}
                <line {...EDGE_DIAG_A} stroke="#d1d5db" strokeWidth={1} />
                <line {...EDGE_DIAG_B} stroke="#d1d5db" strokeWidth={1} />

                {/* 엣지 라벨 */}
                <EdgeLabel x={LBL_TOP.x} y={LBL_TOP.y} count={c01} />
                <EdgeLabel x={LBL_BOTTOM.x} y={LBL_BOTTOM.y} count={c23} />
                <EdgeLabel x={LBL_LEFT.x} y={LBL_LEFT.y} count={c02} />
                <EdgeLabel x={LBL_RIGHT.x} y={LBL_RIGHT.y} count={c13} />
                <EdgeLabel x={LBL_DIAG_A.x} y={LBL_DIAG_A.y} count={c03} />
                <EdgeLabel x={LBL_DIAG_B.x} y={LBL_DIAG_B.y} count={c12} />
              </svg>

              {/* 카드 레이어 (SVG 위) */}
              <div className="absolute" style={{ left: 0, top: 0 }}>
                <PlayerCard player={p0} gameCount={gc(p0)} />
              </div>
              <div className="absolute" style={{ left: CARD_W + H_GAP, top: 0 }}>
                <PlayerCard player={p1} gameCount={gc(p1)} />
              </div>
              <div className="absolute" style={{ left: 0, top: CARD_H + V_GAP }}>
                <PlayerCard player={p2} gameCount={gc(p2)} />
              </div>
              <div className="absolute" style={{ left: CARD_W + H_GAP, top: CARD_H + V_GAP }}>
                <PlayerCard player={p3} gameCount={gc(p3)} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* 확정 / 다시 뽑기 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex gap-3 justify-center"
        >
          <Button onClick={onConfirm} size="lg" className="flex-1 md:flex-none">
            확정
          </Button>
          <Button onClick={onReject} variant="outline" size="lg" className="flex-1 md:flex-none">
            다시 뽑기
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
