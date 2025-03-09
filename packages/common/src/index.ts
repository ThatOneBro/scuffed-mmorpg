// Common types and utilities shared between game and server

export interface Player {
  id: string;
  name: string;
  position: Position;
  health: number;
}

export interface Position {
  x: number;
  y: number;
}

export enum MessageType {
  PLAYER_MOVE = 'PLAYER_MOVE',
  PLAYER_JOIN = 'PLAYER_JOIN',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  GAME_STATE = 'GAME_STATE',
}

export interface Message {
  type: MessageType;
  payload: any;
}

// Utility functions
export function createMessage(type: MessageType, payload: any): Message {
  return { type, payload };
} 