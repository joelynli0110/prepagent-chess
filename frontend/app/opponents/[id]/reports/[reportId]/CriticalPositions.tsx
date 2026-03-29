"use client";

import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

interface CriticalPosition {
  game_id: string;
  ply: number;
  phase?: string | null;
  fen_before: string;
  move_san?: string | null;
  best_move_san?: string | null;
  best_move_uci?: string | null;
  eval_before_cp?: number | null;
  eval_after_cp?: number | null;
  centipawn_loss?: number | null;
  eco?: string | null;
  opening_name?: string | null;
  date_played?: string | null;
}

function evalLabel(cp: number | null | undefined): string {
  if (cp == null) return "?";
  const pawns = cp / 100;
  return (pawns > 0 ? "+" : "") + pawns.toFixed(1);
}

function cplSeverity(cpl: number | null | undefined): string {
  if (cpl == null) return "text-gray-400";
  if (cpl >= 300) return "text-red-700 font-bold";
  if (cpl >= 150) return "text-red-500 font-medium";
  return "text-orange-500";
}

function validateFen(fen: string | undefined): string {
  if (!fen) return "start";
  try {
    new Chess(fen);
    return fen;
  } catch {
    return "start";
  }
}

function BoardCard({
  position,
  index,
  opponentId,
}: {
  position: CriticalPosition;
  index: number;
  opponentId: string;
}) {
  // Arrow for best move
  const arrows = position.best_move_uci && position.best_move_uci.length >= 4
    ? [{ startSquare: position.best_move_uci.slice(0, 2), endSquare: position.best_move_uci.slice(2, 4), color: "rgba(34, 197, 94, 0.85)" }]
    : [];

  const validFen = validateFen(position.fen_before);
  const moveNumber = Math.ceil(position.ply / 2);

  return (
    <div className="rounded-2xl border overflow-hidden">
      {/* Board */}
      <div className="relative">
        <Chessboard
          options={{
            position: validFen,
            boardOrientation: "white",
            arrows,
            allowDragging: false,
            showNotation: false,
            boardStyle: { borderRadius: 0 },
          }}
        />
      </div>

      {/* Info */}
      <div className="p-3 space-y-2 bg-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Position {index + 1}
          </span>
          {position.eco && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
              {position.eco}
            </span>
          )}
        </div>

        {position.opening_name && (
          <p className="text-xs text-gray-600 truncate" title={position.opening_name}>
            {position.opening_name}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">Move </span>
            <span className="font-medium">{moveNumber}</span>
          </div>
          {position.phase && (
            <div>
              <span className="text-gray-400">Phase </span>
              <span className="capitalize font-medium">{position.phase}</span>
            </div>
          )}
          {position.move_san && (
            <div>
              <span className="text-gray-400">Played </span>
              <span className="font-mono font-medium text-red-600">{position.move_san}</span>
            </div>
          )}
          {position.best_move_san && (
            <div>
              <span className="text-gray-400">Best </span>
              <span className="font-mono font-medium text-green-600">{position.best_move_san}</span>
            </div>
          )}
        </div>

        {/* Eval bar */}
        <div className="flex items-center gap-2 pt-1">
          <div className="text-xs text-gray-400">
            {evalLabel(position.eval_before_cp)}
            <span className="mx-1 text-gray-300">→</span>
            {evalLabel(position.eval_after_cp)}
          </div>
          {position.centipawn_loss != null && (
            <span className={`ml-auto text-xs ${cplSeverity(position.centipawn_loss)}`}>
              −{position.centipawn_loss} cp
            </span>
          )}
        </div>

        <a
          href={`/opponents/${opponentId}/games/${position.game_id}`}
          className="block text-center rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          View game →
        </a>
      </div>
    </div>
  );
}

export function CriticalPositions({
  positions,
  opponentId,
}: {
  positions: CriticalPosition[];
  opponentId: string;
}) {
  if (!positions.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Critical Positions</h2>
      <p className="text-sm text-gray-500">
        Highest centipawn-loss blunders. Green squares show the engine&apos;s best move.
      </p>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {positions.map((pos, i) => (
          <BoardCard
            key={`${pos.game_id}-${pos.ply}`}
            position={pos}
            index={i}
            opponentId={opponentId}
          />
        ))}
      </div>
    </section>
  );
}
