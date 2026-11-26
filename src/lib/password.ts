// Regra única de senha, usada ao cadastrar, redefinir e trocar senha.

export const PASSWORD_MIN = 10;
// O bcrypt só lê os primeiros 72 BYTES. Acentos ocupam mais de 1 byte, então
// o limite precisa ser em bytes, senão o final da senha seria ignorado em silêncio.
export const PASSWORD_MAX_BYTES = 72;

// Senhas que aparecem em todas as listas de "mais usadas" (já com 10+ caracteres).
const COMMON = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "9876543210",
  "1234512345",
  "123456789a",
  "a123456789",
  "abcd123456",
  "abcde12345",
  "qwertyuiop",
  "asdfghjkl1",
  "1q2w3e4r5t",
  "1qaz2wsx3e",
  "password123",
  "password12",
  "passw0rd123",
  "senha12345",
  "senha123456",
  "senha@12345",
  "mudar12345",
  "mudar@12345",
  "loja123456",
  "ponto12345",
  "ponto123456",
  "brasil1234",
  "brasil12345",
  "bemvindo123",
  "trocar12345",
]);

/**
 * Devolve a mensagem de erro (em português) ou null se a senha é aceitável.
 * `username` é opcional: se informado, a senha não pode conter o usuário.
 */
export function validatePassword(password: string, username?: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "A senha é longa demais (máximo de 72 caracteres; acentos contam mais de um).";
  }
  if (/^(.)\1+$/.test(password)) {
    return "A senha não pode ser um único caractere repetido.";
  }
  if (COMMON.has(password.toLowerCase())) {
    return "Essa senha é muito comum e fácil de adivinhar. Escolha outra.";
  }
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    return "A senha não pode conter o nome de usuário.";
  }
  return null;
}
