export class ParseError extends Error {
  constructor(...args: Parameters<ErrorConstructor>) {
    super(...args);
    this.name = this.constructor.name;
  }
}

export class BadCharacterError extends ParseError {}
export class NoNameError extends ParseError {}
export class UnterminatedVariableError extends ParseError {}
