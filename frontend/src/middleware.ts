import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const role = request.cookies.get('role')?.value?.toLowerCase()
  
  const path = request.nextUrl.pathname

  const isProtectedRoute = path.startsWith('/dashboard') || 
                           path.startsWith('/problems') || 
                           path.startsWith('/arena') ||
                           path.startsWith('/teacher') ||
                           path.startsWith('/admin')

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  if (path.startsWith('/teacher') && role !== 'teacher' && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
