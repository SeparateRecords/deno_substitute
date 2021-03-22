import {
  BadCharacterError,
  NoNameError,
  UnterminatedVariableError,
} from "./_errors.ts";

// Deno disallows "", "=", and "\0" in Deno.env.get
const invalidCharacters = new Set(["", "=", "\x00"]);

export interface SubstituteOptions {
  /**
   * Toggle `%VAR%` variables.
   * This is enabled by default.
   */
  percent?: boolean;
  /**
   * Toggle `$VAR` and `${VAR}` variables.
   * This is enabled by default.
   */
  dollar?: boolean;
  /**
   * Throw an error instead of recovering gracefully from a bad substitution.
   * This is enabled by default.
   */
  strict?: boolean;
}

/**
 * Substitute variables in a string for other values.
 *
 * Bash and CMD-style variables ('dollar' and 'percent') are accepted by
 * default. These can be toggled using the options object.
 *
 *     substitute("$HOME/.config", Deno.env.get)
 *     substitute("${XDG_DATA_HOME}", Deno.env.get)
 *     substitute("%USERPROFILE%", Deno.env.get, { percent: false, strict: false })
 *
 * Errors will be thrown by default, but all inputs can return a valid string
 * if `{ strict: false }`.
 *
 *     substitute("%HELLO% ${Name=World}", (x) => x.toLowerCase())
 *     // BadCharacterError: Error parsing ${Name: Unexpected character: =
 *     substitute("%HELLO% ${Name=World}", (x) => x.toLowerCase(), { strict: false })
 *     // => "hello ${Name=World}"
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
          // } ends the variable
          if (char !== "}" && !invalidCharacters.has(char)) {
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
        // pretty much anything non-alphanumeric ends the variable
        if (/[A-Za-z0-9_]/.test(char)) {
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
        // 'i' is on the character after the variable finished, decrement
        // so it's parsed on the next loop
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
        // % ends the variable
        if (char !== "%" && !invalidCharacters.has(char)) {
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
