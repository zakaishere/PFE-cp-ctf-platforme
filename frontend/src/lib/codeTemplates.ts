export type Language = 'java' | 'python' | 'cpp' | 'c' | 'javascript' | 'kotlin';

export const LANGUAGES: { value: Language; label: string; icon: string }[] = [
  { value: 'java',       label: 'Java',       icon: '☕' },
  { value: 'python',     label: 'Python 3',   icon: '🐍' },
  { value: 'cpp',        label: 'C++',        icon: '⚡' },
  { value: 'c',          label: 'C',          icon: '🔧' },
  { value: 'javascript', label: 'JavaScript', icon: '🌐' },
  { value: 'kotlin',     label: 'Kotlin',     icon: '🎯' },
];

export function monacoLang(lang: Language): string {
  const map: Record<Language, string> = {
    java: 'java', python: 'python', cpp: 'cpp',
    c: 'c', javascript: 'javascript', kotlin: 'kotlin',
  };
  return map[lang] ?? 'plaintext';
}

export function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem('preferred-language') as Language;
    const valid: Language[] = ['java', 'python', 'cpp', 'c', 'javascript', 'kotlin'];
    if (saved && valid.includes(saved)) return saved;
  } catch {}
  return 'java';
}

export const TEMPLATES: Record<Language, string> = {
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Your solution here
    }
}`,

  python: `import sys
input = sys.stdin.readline

def solve():
    # Your solution here
    pass

solve()`,

  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Your solution here
    return 0;
}`,

  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Your solution here
    return 0;
}`,

  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');
let idx = 0;

// Your solution here`,

  kotlin: `import java.util.Scanner

fun main() {
    val sc = Scanner(System.\`in\`)
    // Your solution here
}`,
};

export function getTemplate(lang: Language): string {
  return TEMPLATES[lang] ?? '';
}
