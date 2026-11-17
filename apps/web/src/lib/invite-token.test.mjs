import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractInviteToken,
  isValidBrPhone,
  isValidFullName,
  isValidRegistrationPassword,
  phoneInput,
} from './invite-token.ts';

test('extractInviteToken lê exclusivamente #token= do fragmento', () => {
  assert.equal(extractInviteToken('#token=hash-secret'), 'hash-secret');
  assert.equal(extractInviteToken('#foo=1&token=%20abc123%20'), 'abc123');
  assert.equal(extractInviteToken(''), null);
  assert.equal(extractInviteToken('#token=   '), null);
  assert.equal(extractInviteToken('#other=1'), null);
});

test('phoneInput formata telefones de 10 e 11 dígitos e isValidBrPhone valida DDD+número', () => {
  assert.equal(phoneInput('81998765432'), '(81) 99876-5432');
  assert.equal(phoneInput('8134567890'), '(81) 3456-7890');
  assert.equal(isValidBrPhone('(81) 99876-5432'), true);
  assert.equal(isValidBrPhone('(81) 3456-7890'), true);
  assert.equal(isValidBrPhone('12345'), false);
});

test('isValidFullName exige nome e sobrenome (3..120 chars)', () => {
  assert.equal(isValidFullName('Maria Silva'), true);
  assert.equal(isValidFullName('  João   da Silva  '), true);
  assert.equal(isValidFullName('Maria'), false);
  assert.equal(isValidFullName('A B'), true);
  assert.equal(isValidFullName(''), false);
});

test('isValidRegistrationPassword exige 8..72 caracteres com letras e números', () => {
  assert.equal(isValidRegistrationPassword('Segura12'), true);
  assert.equal(isValidRegistrationPassword('somenteletras'), false);
  assert.equal(isValidRegistrationPassword('12345678'), false);
  assert.equal(isValidRegistrationPassword('Abc1234'), false);
  assert.equal(isValidRegistrationPassword(`${'a'.repeat(72)}1`), false);
});
