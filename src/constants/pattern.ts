export const EMAIL_PATTRERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// 서버와 같은 규칙: 영문·숫자·특수문자를 모두 넣은 8~64자(QA AUTH-A03)
export const PASSWORD_PATTRERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,64}$/;
export const PHONE_PATTRERN = /^010\d{8}$/;
