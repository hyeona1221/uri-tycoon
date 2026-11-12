# 우리집 자산관리(주)

2D 도트 타이쿤 감성의 부부 가계부 웹 앱.

- 사무실 장면: 에이스 사원(아내), 대표이사(남편), 신입사원 찬솔이, 인턴 초아, 이월 금고
- 고정비 결재 체크리스트 (결재 도장), 받은 돈 입력, 예약금
- 변동비 품의서 (10개 부서, 결제수단), 부서별 차트, 결재 장부 (수정/삭제)
- 이월 금고: 받은 돈 − 고정비 − 변동비 = 남은 돈이 다음 달로 쌓임
- 무지출 데이, 레벨, 8비트 효과음, 캐릭터 반응
- Supabase 저장 + 실시간 동기화 (폰과 PC), 이메일 로그인 1회 + 기기별 4자리 PIN

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 화면 구조 |
| `style.css` | 디자인 |
| `app.js` | 동작 (계산, 저장, 잠금, 효과) |
| `config.js` | Supabase 주소와 공개 키 |
| `assets/` | 배경 그림과 캐릭터 도트 |
| `supabase/schema.sql` | 데이터베이스 설정 (SQL Editor에서 1회 실행) |

## 설정 순서

1. Supabase 프로젝트를 만들고 `supabase/schema.sql`을 SQL Editor에서 실행 (맨 아래 이메일 2줄 수정)
2. Authentication > Users 에서 두 사람 계정 생성, 새 가입 막기
3. `config.js`에 Project URL과 anon(publishable) 키 입력
4. GitHub Pages로 배포

`config.js`에는 공개용 키만 넣습니다. 데이터는 Supabase 행 수준 보안(RLS)으로 `members` 표에 있는 이메일만 읽고 쓸 수 있습니다.
