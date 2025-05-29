import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MoveRequest, MoveResponse, GameState, ChessPiece } from '../models/chess.models';

@Injectable({
  providedIn: 'root'
})
export class ChessService {
  private apiUrl = 'http://localhost:8080/api/chess';
  private initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  constructor(private http: HttpClient) {}

  getBestMove(fen: string): Observable<MoveResponse> {
    // Validate FEN before sending to backend
    console.log('Validating FEN:', fen);
    
    // Check basic FEN format
    const fenParts = fen.split(' ');
    if (fenParts.length !== 6) {
      console.error('FEN format error: should have 6 parts');
    }
    
    // Check board position part
    const boardPart = fenParts[0];
    const rows = boardPart.split('/');
    if (rows.length !== 8) {
      console.error('FEN format error: board should have 8 rows');
    }
    
    const request: MoveRequest = { fen };
    return this.http.post<MoveResponse>(`${this.apiUrl}/move`, request);
  }

  createInitialGameState(): GameState {
    return {
      fen: this.initialFen,
      board: this.fenToBoard(this.initialFen),
      currentPlayer: 'white',
      gameOver: false
    };
  }

  fenToBoard(fen: string): (ChessPiece | null)[][] {
    const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    const fenBoard = fen.split(' ')[0];
    const rows = fenBoard.split('/');

    for (let row = 0; row < 8; row++) {
      let col = 0;
      for (const char of rows[row]) {
        if (char >= '1' && char <= '8') {
          col += parseInt(char);
        } else {
          const piece = this.charToPiece(char);
          if (piece) {
            board[row][col] = piece;
          }
          col++;
        }
      }
    }
    return board;
  }

  private charToPiece(char: string): ChessPiece | null {
    const pieceMap: { [key: string]: { type: ChessPiece['type'], color: 'white' | 'black' } } = {
      'p': { type: 'pawn', color: 'black' },
      'r': { type: 'rook', color: 'black' },
      'n': { type: 'knight', color: 'black' },
      'b': { type: 'bishop', color: 'black' },
      'q': { type: 'queen', color: 'black' },
      'k': { type: 'king', color: 'black' },
      'P': { type: 'pawn', color: 'white' },
      'R': { type: 'rook', color: 'white' },
      'N': { type: 'knight', color: 'white' },
      'B': { type: 'bishop', color: 'white' },
      'Q': { type: 'queen', color: 'white' },
      'K': { type: 'king', color: 'white' }
    };

    const pieceInfo = pieceMap[char];
    return pieceInfo ? { ...pieceInfo, position: '' } : null;
  }

  boardToFen(board: (ChessPiece | null)[][], currentPlayer: 'white' | 'black'): string {
    let fen = '';
    
    // Process board position
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          // Map piece to FEN character
          const pieceChar = this.getPieceChar(piece);
          fen += pieceChar;
        } else {
          emptyCount++;
        }
      }
      
      // Add any remaining empty squares
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      
      // Add row separator (except for the last row)
      if (row < 7) {
        fen += '/';
      }
    }
    
    // Add active color
    fen += currentPlayer === 'white' ? ' w' : ' b';
    
    // Add castling availability (simplified)
    fen += ' KQkq';
    
    // Add en passant target square (simplified)
    fen += ' -';
    
    // Add halfmove clock and fullmove number (simplified)
    fen += ' 0 1';
    
    return fen;
  }

  private getPieceChar(piece: ChessPiece): string {
    const pieceTypeToChar: { [key: string]: string } = {
      'pawn': 'p',
      'rook': 'r',
      'knight': 'n',
      'bishop': 'b',
      'queen': 'q',
      'king': 'k'
    };
    
    let char = pieceTypeToChar[piece.type];
    if (piece.color === 'white') {
      char = char.toUpperCase();
    }
    
    return char;
  }

  parseMove(move: string): { from: [number, number], to: [number, number] } {
    if (move.length < 4) throw new Error('Invalid move format');
    
    const fromCol = move.charCodeAt(0) - 97; // 'a' = 97
    const fromRow = 8 - parseInt(move[1]);
    const toCol = move.charCodeAt(2) - 97;
    const toRow = 8 - parseInt(move[3]);
    
    return {
      from: [fromRow, fromCol],
      to: [toRow, toCol]
    };
  }
}
