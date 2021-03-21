import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.90.0/testing/asserts.ts";
import { substitute, SubstituteOptions } from "./substitute.ts";
import {
  BadCharacterError,
  NoNameError,
  ParseError,
  UnterminatedVariableError,
} from "./_errors.ts";

type TestCase = {
  have: string;
  want: string;
};

type FallibleTestErrorType = {
  error?: typeof ParseError;
};

/**
 * Each case *must* succeed when not in strict mode, and fail with the
 * given error in strict mode. If there is no error, it is expected
 * to succeed in strict mode.
 */
const strictCases: (TestCase & FallibleTestErrorType)[] = [
  {
    have: "",
    want: "",
  },
  {
    have: "$",
    want: "$",
  },
  {
    have: "$abc",
    want: "ABC",
  },
  {
    have: "$$abc",
    want: "$abc",
  },
  {
    have: "abc$abc$xyz",
    want: "abcABCXYZ",
  },
  {
    have: "abc$abc-lower-$xyz",
    want: "abcABC-lower-XYZ",
  },
  {
    have: "/$abc/$def",
    want: "/ABC/DEF",
  },
  {
    have: "/$/$def",
    want: "/$/DEF",
  },
  {
    have: "//PC/C$/Windows",
    want: "//PC/C$/Windows",
  },
  {
    have: "${",
    want: "${",
    error: UnterminatedVariableError,
  },
  {
    have: "${a",
    want: "${a",
    error: UnterminatedVariableError,
  },
  {
    have: "${}",
    want: "${}",
    error: NoNameError,
  },
  {
    have: "$${}",
    want: "${}",
  },
  {
    have: "$${abc}",
    want: "${abc}",
  },
  {
    have: "abc${def}ghi",
    want: "abcDEFghi",
  },
  {
    have: "abc${def/hello}ghi",
    want: "abcDEF/HELLOghi",
  },
  {
    have: "${\u1234}",
    want: "${\u1234}",
    error: BadCharacterError,
  },
  {
    have: "%",
    want: "%",
    error: UnterminatedVariableError,
  },
  {
    have: "%%",
    want: "%",
  },
  {
    have: "a%%",
    want: "a%",
  },
  {
    have: "%%%",
    want: "%%",
    error: UnterminatedVariableError,
  },
  {
    have: "%%a%",
    want: "%a%",
    error: UnterminatedVariableError,
  },
  {
    have: "%a",
    want: "%a",
    error: UnterminatedVariableError,
  },
  {
    have: "%\u1234%",
    want: "%\u1234%",
    error: BadCharacterError,
  },
  {
    have: "abc%def%ghi",
    want: "abcDEFghi",
  },
  {
    have: "abc%def/hello%ghi",
    want: "abcDEF/HELLOghi",
  },
  {
    have: "abc%def/hello%ghi%",
    want: "abcDEF/HELLOghi%",
    error: UnterminatedVariableError,
  },
];

Deno.test("substitute { strict: true }", () => {
  const fn = (key: string) => key.toUpperCase();
  for (const { have, want, error } of strictCases) {
    if (error !== undefined) {
      assertThrows(() => substitute(have, fn), error);
    } else {
      // shouldn't throw. the test will fail if it does
      const got = substitute(have, fn);
      assertEquals(got, want);
    }
  }
});

Deno.test("substitute { strict: false }", () => {
  const fn = (key: string) => key.toUpperCase();
  for (const { have, want } of strictCases) {
    const got = substitute(have, fn, { strict: false });
    assertEquals(got, want);
  }
});

const optionCases: (TestCase & SubstituteOptions)[] = [
  {
    have: "%abc% $abc ${abc}",
    want: "%abc% ABC ABC",
    percent: false,
  },
  {
    have: "%abc% $abc ${abc}",
    want: "ABC $abc ${abc}",
    dollar: false,
  },
  {
    have: "%abc% $abc ${abc}",
    want: "%abc% $abc ${abc}",
    percent: false,
    dollar: false,
  },
  {
    have: "%% $$",
    want: "%% $",
    percent: false,
  },
  {
    have: "%% $$",
    want: "% $$",
    dollar: false,
  },
  {
    have: "%% $$",
    want: "%% $$",
    percent: false,
    dollar: false,
  },
];

Deno.test("substitute { percent, dollar }", () => {
  const fn = (s: string) => s.toUpperCase();
  for (const { have, want, percent, dollar, strict } of optionCases) {
    const got = substitute(have, fn, { percent, dollar, strict });
    assertEquals(got, want);
  }
});
