import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessService } from '../services/chess.service';
import { GameState, ChessPiece } from '../models/chess.models';

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.css']
})
export class ChessBoardComponent implements OnInit {
  gameState!: GameState;
  selectedSquare: { row: number, col: number } | null = null;
  possibleMoves: [number, number][] = [];
  isThinking = false;

  constructor(private chessService: ChessService) {}

  ngOnInit() {
    this.resetGame();
  }

  resetGame() {
    this.gameState = this.chessService.createInitialGameState();
    this.selectedSquare = null;
    this.possibleMoves = [];
  }

  onSquareClick(row: number, col: number) {
    if (this.gameState.gameOver) return;

    const piece = this.gameState.board[row][col];
    
    if (this.selectedSquare) {
      // Try to make a move
      if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
        // Deselect
        this.selectedSquare = null;
        this.possibleMoves = [];
      } else {
        // Make move
        this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
      }
    } else if (piece && piece.color === this.gameState.currentPlayer) {
      // Select piece
      this.selectedSquare = { row, col };
      this.possibleMoves = this.calculatePossibleMoves(row, col, piece);
    }
  }

  makeMove(fromRow: number, fromCol: number, toRow: number, toCol: number, isAIMove: boolean = false) {
    const piece = this.gameState.board[fromRow][fromCol];
    if (!piece) return;

    // Check if the move is valid (skip validation for AI moves since they come from Stockfish)
    const isValidMove = isAIMove || this.possibleMoves.some(([r, c]) => r === toRow && c === toCol);
    if (!isValidMove) return;

    const targetPiece = this.gameState.board[toRow][toCol];
    const isCapture = targetPiece !== null;
    
    // Make the move
    this.gameState.board[toRow][toCol] = piece;
    this.gameState.board[fromRow][fromCol] = null;
    
    // Handle atomic explosion for captures (except pawns capturing pawns)
    if (isCapture && !(piece.type === 'pawn' && targetPiece.type === 'pawn')) {
      this.handleExplosion(toRow, toCol);
    }
    
    // Check for game over conditions
    this.checkGameOver();
    
    // Switch players
    this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';
    
    // Update FEN
    this.gameState.fen = this.chessService.boardToFen(this.gameState.board, this.gameState.currentPlayer);
    
    // Clear selection
    this.selectedSquare = null;
    this.possibleMoves = [];
  }

  private handleExplosion(row: number, col: number) {
    // Remove pieces in 3x3 area around the capture (this is the atomic chess rule)
    for (let i = row - 1; i <= row + 1; i++) {
      for (let j = col - 1; j <= col + 1; j++) {
        if (this.isInBounds(i, j) && !(i === row && j === col)) {
          const pieceAtExplosion = this.gameState.board[i][j];
          // Only non-pawn pieces are affected by explosions
          if (pieceAtExplosion && pieceAtExplosion.type !== 'pawn') {
            this.gameState.board[i][j] = null;
          }
        }
      }
    }
    // The capturing piece also gets destroyed
    this.gameState.board[row][col] = null;
  }

  private checkGameOver() {
    // Check if any player has lost their king
    let whiteKingExists = false;
    let blackKingExists = false;
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = this.gameState.board[i][j];
        if (piece && piece.type === 'king') {
          if (piece.color === 'white') whiteKingExists = true;
          else blackKingExists = true;
        }
      }
    }
    
    if (!whiteKingExists || !blackKingExists) {
      this.gameState.gameOver = true;
      this.gameState.winner = whiteKingExists ? 'white' : 'black';
    }
  }

  makeAIMove(retryCount: number = 0) {
    if (this.gameState.currentPlayer !== 'black' || this.isThinking) return;
    
    // Maximum retry attempts to prevent infinite loops
    const MAX_RETRIES = 3;
    
    if (retryCount >= MAX_RETRIES) {
      console.error(`Failed to get valid AI move after ${MAX_RETRIES} attempts`);
      this.handleAIError();
      return;
    }
    
    this.isThinking = true;
    console.log(`Sending FEN to backend (attempt ${retryCount + 1}):`, this.gameState.fen);
    
    this.chessService.getBestMove(this.gameState.fen).subscribe({
      next: (response) => {
        console.log('Received AI response:', response);
        if (response.move && response.move.length >= 4) {
          try {
            const { from, to } = this.chessService.parseMove(response.move);
            console.log('Parsed move:', from, to);
            
            // Validate the move before trying to execute it
            const piece = this.gameState.board[from[0]][from[1]];
            if (!piece || piece.color !== 'black') {
              console.error('Invalid AI move: No black piece at starting position', from);
              this.isThinking = false;
              // Retry with a new request
              this.makeAIMove(retryCount + 1);
              return;
            }
            
            // Execute the move
            this.makeMove(from[0], from[1], to[0], to[1], true);
          } catch (error) {
            console.error('Error parsing move:', error);
            this.isThinking = false;
            // Retry with a new request
            this.makeAIMove(retryCount + 1);
            return;
          }
        } else {
          console.warn('Invalid move received from AI:', response.move);
          this.isThinking = false;
          // Retry with a new request
          this.makeAIMove(retryCount + 1);
          return;
        }
        this.isThinking = false;
      },
      error: (error) => {
        console.error('Error getting AI move:', error);
        this.isThinking = false;
        // Retry on network error
        this.makeAIMove(retryCount + 1);
      }
    });
  }

  private handleAIError() {
    // Find a random valid move for the AI
    const validMoves = this.findAllValidMovesForPlayer('black');
    
    if (validMoves.length > 0) {
      // Choose a random move
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      const { piece, from, to } = validMoves[randomIndex];
      
      // Make the random move
      console.log('AI making random move:', from, 'to', to);
      this.makeMove(from[0], from[1], to[0], to[1]);
    } else {
      // No valid moves, declare game over
      console.warn('AI has no valid moves, game over');
      this.gameState.gameOver = true;
      this.gameState.winner = 'white';
    }
  }

  private findAllValidMovesForPlayer(color: 'white' | 'black'): Array<{ 
    piece: ChessPiece, 
    from: [number, number], 
    to: [number, number] 
  }> {
    const moves: Array<{ piece: ChessPiece, from: [number, number], to: [number, number] }> = [];
    
    // Iterate through the board to find all pieces of the specified color
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col];
        if (piece && piece.color === color) {
          // Calculate possible moves for this piece
          const possibleMoves = this.calculatePossibleMoves(row, col, piece);
          
          // Add each move to our list
          for (const [toRow, toCol] of possibleMoves) {
            moves.push({
              piece,
              from: [row, col],
              to: [toRow, toCol]
            });
          }
        }
      }
    }
    
    return moves;
  }

  calculatePossibleMoves(row: number, col: number, piece: ChessPiece): [number, number][] {
    const moves: [number, number][] = [];
    
    // Different movement patterns based on piece type
    switch(piece.type) {
      case 'pawn':
        this.addPawnMoves(row, col, piece.color, moves);
        break;
      case 'rook':
        this.addStraightMoves(row, col, piece.color, moves);
        break;
      case 'knight':
        this.addKnightMoves(row, col, piece.color, moves);
        break;
      case 'bishop':
        this.addDiagonalMoves(row, col, piece.color, moves);
        break;
      case 'queen':
        this.addStraightMoves(row, col, piece.color, moves);
        this.addDiagonalMoves(row, col, piece.color, moves);
        break;
      case 'king':
        this.addKingMoves(row, col, piece.color, moves);
        break;
    }
    
    return moves;
  }

  private addPawnMoves(row: number, col: number, color: 'white' | 'black', moves: [number, number][]) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    
    // Forward move
    if (this.isInBounds(row + direction, col) && !this.gameState.board[row + direction][col]) {
      moves.push([row + direction, col]);
      
      // Double move from starting position
      if (row === startRow && 
          !this.gameState.board[row + direction][col] && 
          !this.gameState.board[row + direction * 2][col]) {
        moves.push([row + direction * 2, col]);
      }
    }
    
    // Capture moves
    for (const captureCol of [col - 1, col + 1]) {
      if (this.isInBounds(row + direction, captureCol)) {
        const targetPiece = this.gameState.board[row + direction][captureCol];
        if (targetPiece && targetPiece.color !== color) {
          moves.push([row + direction, captureCol]);
        }
      }
    }
  }

  private addStraightMoves(row: number, col: number, color: 'white' | 'black', moves: [number, number][]) {
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // right, down, left, up
    
    for (const [dx, dy] of directions) {
      let x = row + dx;
      let y = col + dy;
      
      while (this.isInBounds(x, y)) {
        const targetPiece = this.gameState.board[x][y];
        if (!targetPiece) {
          moves.push([x, y]);
        } else {
          if (targetPiece.color !== color) {
            moves.push([x, y]);
          }
          break; // Stop after hitting a piece
        }
        x += dx;
        y += dy;
      }
    }
  }

  private addDiagonalMoves(row: number, col: number, color: 'white' | 'black', moves: [number, number][]) {
    const directions = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // down-right, down-left, up-left, up-right
    
    for (const [dx, dy] of directions) {
      let x = row + dx;
      let y = col + dy;
      
      while (this.isInBounds(x, y)) {
        const targetPiece = this.gameState.board[x][y];
        if (!targetPiece) {
          moves.push([x, y]);
        } else {
          if (targetPiece.color !== color) {
            moves.push([x, y]);
          }
          break; // Stop after hitting a piece
        }
        x += dx;
        y += dy;
      }
    }
  }

  private addKnightMoves(row: number, col: number, color: 'white' | 'black', moves: [number, number][]) {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dx, dy] of offsets) {
      const x = row + dx;
      const y = col + dy;
      
      if (this.isInBounds(x, y)) {
        const targetPiece = this.gameState.board[x][y];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push([x, y]);
        }
      }
    }
  }

  private addKingMoves(row: number, col: number, color: 'white' | 'black', moves: [number, number][]) {
    const offsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dx, dy] of offsets) {
      const x = row + dx;
      const y = col + dy;
      
      if (this.isInBounds(x, y)) {
        const targetPiece = this.gameState.board[x][y];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push([x, y]);
        }
      }
    }
  }

  private isInBounds(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  isHighlighted(row: number, col: number): boolean {
    return this.possibleMoves.some(([r, c]) => r === row && c === col);
  }

  getPieceClass(piece: ChessPiece): string {
    return piece.color;
  }

  getPieceSymbol(piece: ChessPiece): string {
    const symbols: { [key: string]: string } = {
      'king': '♔♚',
      'queen': '♕♛',
      'rook': '♖♜',
      'bishop': '♗♝',
      'knight': '♘♞',
      'pawn': '♙♟'
    };
    
    const symbolPair = symbols[piece.type];
    return piece.color === 'white' ? symbolPair[0] : symbolPair[1];
  }
}