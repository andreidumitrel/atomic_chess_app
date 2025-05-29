export interface MoveRequest {
  fen: string;
}

export interface MoveResponse {
  move: string;
}

export interface ChessPiece {
  type: 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
  color: 'white' | 'black';
  position: string;
}

export interface GameState {
  fen: string;
  board: (ChessPiece | null)[][];
  currentPlayer: 'white' | 'black';
  gameOver: boolean;
  winner?: 'white' | 'black' | 'draw';
}