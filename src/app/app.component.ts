import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChessBoardComponent } from "./chess-board/chess-board.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChessBoardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'atomicchess';
}
