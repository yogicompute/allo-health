import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code: code ?? 'ERROR', status }, { status })
}