/**
 * TypeScript型定義 for quoted-printable
 */
declare module 'quoted-printable' {
  export function encode(text: string): string;
  export function decode(text: string): string;
}
