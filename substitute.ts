import {
  BadCharacterError,
  NoNameError,
  UnterminatedVariableError,
} from "./_errors.ts";

/**
 * Characters valid within a dollar-brace variable, `${VAR}`.
 * Most characters are valid, except for anything that would end the
 * variable, such as `}`.
 * The equals sign `=` is reserved.
 */
// deno-fmt-ignore
const CHARS_DOLLAR_BRACE = new Set(
  "abcdefghijklmnopqrstuvwxyz" + // Lower case a-z
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + // Upper case A-Z
  "`0123456789-" +   // number row         (missing '=')
  "~!@#$%^&*()_+" +  // number row + shift
  "[]{|;:'\",.<>/? " // remaining          (missing '}')
)

/**
 * Characters valid within a bare dollar variable, `$VAR`.
 * These variables are delimited by characters not in this set.
 */
// deno-fmt-ignore
const CHARS_DOLLAR = new Set(
  "abcdefghijklmnopqrstuvwxyz" + // [a-z]
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + // [A-Z]
  "0123456789_" // [0-9_]
)

/**
 * Characters valid within a percent variable, `%VAR%`.
 * Most characters are valid, except for anything that would end the
 * variable, such as `%`.
 * The equals sign `=` is reserved.
 */
// deno-fmt-ignore
const CHARS_PERCENT = new Set(
  "abcdefghijklmnopqrstuvwxyz" + // Lower case a-z
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + // Upper case A-Z
  "`0123456789-" +   // number row         (missing '=')
  "~!@#$^&*()_+" +   // number row + shift (missing '%')
  "[]{}|;:'\",.<>/? " // remaining
);

export interface SubstituteOptions {
  /**
   * Toggle `%VAR%` variables.
   * This is true by default.
   */
  percent?: boolean;
  /**
   * Toggle `$VAR` and `${VAR}` variables.
   * This is true by default.
   */
  dollar?: boolean;
  /**
   * Throw an error instead of recovering gracefully from a bad substitution.
   * This is true by default.
   *
   * The following cases will cause an error:
   * * Substitutions without a variable: `"${}"`
   * * Unterminated substitutions: `"${var"`, `"%var"`
   * * Unexpected characters: `"${var=}"`, `"%var=%"`
   * @example
   * substitute("Hello, ${}", (x) => x)
   * // NoNameError: Expected variable name at column 8
   * substitute("Hello, ${}", (x) => x, {error: false})
   * // => "Hello, ${}"
   */
  strict?: boolean;
}

/**
 * Substitute variables in a string for other values.
 *
 * Bash and CMD-style variables ('dollar' and 'percent') are accepted by
 * default. These can be toggled using the options object.
 *
 * @param str Input string to parse
 * @param fn A function that returns a string to fn for its input
 * @returns Parsed string
 *
 * @example
 * substitute("$HOME/.config", Deno.env.get)
 * @example
 * substitute("%USERPROFILE%", Deno.env.get, { percent: false, error: false })
 */
export function substitute(
  str: string,
  fn: (key: string) => string | undefined,
  { percent = true, dollar = true, strict = true }: SubstituteOptions = {},
): string {
  let finalString = "";
  // 'i' will be incremented in the body of this loop
  for (let i = 0; i < str.length; i++) {
    let char = str.charAt(i);

    if (dollar && char === "$") {
      // $$ -> '$'
      if (str.charAt(i + 1) === "$") {
        // point at the second $ so that when incremented it's
        // on the character after that
        i++;
        finalString += "$";
        continue;
      }
      // ${variable}
      if (str.charAt(i + 1) === "{") {
        i++;
        char = str.charAt(i);
        // if the expansion ends immediately, add it literally
        if (str.charAt(i + 1) === "}") {
          // ... unless that should be an error
          if (strict) {
            throw new NoNameError(
              `Expected variable name at column ${i}`,
            );
          }
          // i is currently pointing at '{', increment it once so
          // when incremented again on the next loop it's on the
          // character after the '}'
          i++;
          finalString += "${}";
          break;
        }
        let varName = "";
        // scan until an invalid character is found
        for (;;) {
          i++;
          char = str.charAt(i);
          if (CHARS_DOLLAR_BRACE.has(char)) {
            varName += char;
            continue;
          }
          // found the matching closing brace without encountering
          // an invalid character, get the value and stop scanning
          if (char === "}") {
            const varValue = fn(varName) ?? "";
            finalString += varValue;
            break;
          }
          // reached an invalid character that wasn't the closing brace.
          if (strict) {
            if (char === "") {
              throw new UnterminatedVariableError(
                `Error parsing \${${varName}: Ran out of string`,
              );
            }
            throw new BadCharacterError(
              `Error parsing \${${varName}: Unexpected character: ${char}`,
            );
          }
          // Add the variable literal and this character, then stop scanning.
          finalString += "${" + varName + char;
          break;
        }
        continue;
      } // end ${variable}

      // $variable
      // Only continue if the first character after the dollar sign
      // is valid as part of an identifier.
      let varName = "";
      for (;;) {
        i++;
        char = str.charAt(i);
        // keep scanning until reaching a character that isn't
        // valid as an identifier
        if (CHARS_DOLLAR.has(char)) {
          varName += char;
          continue;
        }
        // there was an invalid character, the variable name has ended.
        // if that character was immediately after the $, the name will be
        // empty. this is not an error, \\addr\dir$\ is a common pattern
        if (varName === "") {
          finalString += "$" + char;
          break;
        }
        const varValue = fn(varName) ?? "";
        finalString += varValue;
        // decrementing `i` because it'll be incremented again
        i--;
        break;
      }
      continue;
    } // end dollar

    if (percent && char === "%") {
      // double percent is an escape
      if (str.charAt(i + 1) === "%") {
        // i is on the first percent. incrementing to the second percent
        // so on the next loop it's on the character after that.
        i++;
        finalString += "%";
        continue;
      }
      let varName = "";
      // scan until an invalid character is found
      for (;;) {
        i++;
        char = str.charAt(i);
        if (CHARS_PERCENT.has(char)) {
          varName += char;
          continue;
        }
        // the character isn't part of an identifier. if it's a %,
        // that's the end of this variable name.
        if (char === "%") {
          const varValue = fn(varName) ?? "";
          finalString += varValue;
          break;
        }
        // it wasn't a percent, so it must have been another invalid
        // character.
        if (strict) {
          if (char === "") {
            throw new UnterminatedVariableError(
              `Error parsing %${varName}: Ran out of string`,
            );
          }
          throw new BadCharacterError(
            `Error parsing %${varName}: Unexpected character: ${char}`,
          );
        }
        // error mode would exit the function, otherwise add the
        finalString += "%" + varName + char;
        break; // stop scanning
      }
      continue;
    } // end percent

    // no conditions were met, this is a normal character
    finalString += char;
  }
  return finalString;
}
