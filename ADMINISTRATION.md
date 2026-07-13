# 관리자 로그인 설정

관리자 로그인은 Supabase Auth 인증과 `admin_users` 허용 목록을 함께 확인합니다.

1. 초기 스키마를 적용한 뒤 `supabase/migrations/202607130002_admin_users.sql`을 Supabase SQL Editor에서 실행합니다.
2. Supabase Dashboard의 **Authentication → Users**에서 관리자 이메일과 비밀번호로 사용자를 생성합니다.
3. 생성된 사용자의 UUID를 복사한 뒤 SQL Editor에서 다음을 실행합니다.

```sql
insert into public.admin_users (user_id)
values ('관리자-사용자-UUID');
```

4. `.env.local`에 Publishable key를 추가합니다.

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY`는 서버 전용 값입니다. `NEXT_PUBLIC_` 접두사를 붙이거나 브라우저 코드에 노출하지 마세요.

`/admin/login`에서 등록한 계정으로 로그인할 수 있습니다. 세션은 HTTP-only 쿠키에 저장되고, `/admin`에 접근할 때마다 Auth 사용자와 관리자 허용 목록을 다시 확인합니다.
