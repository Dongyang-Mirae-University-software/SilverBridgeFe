// 자격·개인 정보 폼은 method="post"여야 한다.
// method가 없으면 JS가 붙기 전(하이드레이션 전)에 제출될 때 브라우저가 GET으로 보내
// 이메일·비밀번호가 주소 쿼리(/login?email=…&password=…)로 브라우저 기록·서버 접근 로그에 남는다(2026-10-31 실제 발생).
// 하이드레이션 뒤에는 onSubmit의 preventDefault가 막으므로 동작은 같다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const AUTH_DIR = `app${sep}(auth)${sep}`;
const CREDENTIAL_INPUT =
  /name="(password|newPassword|confirmPassword|passwordCheck)"|register\('(password|passwordCheck)'/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') && !/\.test\.tsx$/.test(path) ? [path] : [];
  });
}

// JSX 속성의 {…} 안의 '>'(화살표 함수 등)를 건너뛰며 <form …> 여는 태그를 잘라 낸다.
function formOpeningTags(source: string): string[] {
  const tags: string[] = [];
  for (let start = source.indexOf('<form'); start !== -1; start = source.indexOf('<form', start + 5)) {
    if (/[\w-]/.test(source[start + 5] ?? '')) continue;
    let depth = 0;
    let end = start;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    tags.push(source.slice(start, end + 1));
  }
  return tags;
}

const targets = tsxFiles(SRC)
  .map(path => ({ path: relative(SRC, path), source: readFileSync(path, 'utf8') }))
  .filter(({ path, source }) => path.startsWith(AUTH_DIR) || CREDENTIAL_INPUT.test(source))
  .flatMap(({ path, source }) => formOpeningTags(source).map(tag => ({ path, tag })));

describe('자격·개인 정보 폼 method="post"', () => {
  it('대상 폼을 실제로 찾는다(검사가 비어서 통과하지 않게)', () => {
    expect(targets.filter(({ path }) => path.startsWith(AUTH_DIR)).length).toBeGreaterThanOrEqual(6);
  });

  it.each(targets.map(({ path, tag }) => [path, tag]))('%s', (_path, tag) => {
    expect(tag).toMatch(/\smethod="post"/);
  });
});
