# deno_substitute

**Simple, familiar, fast-enough variable substitution.**<br>
Perfect for environment variables, flexible enough for whatever.

<br>

## Usage

`substitute` substitutes variables using a function.

```typescript
import { substitute } from "https://deno.land/x/substitute@0.1.0/mod.ts";

substitute("Welcome $HOME", Deno.env.get);
// => "Welcome /home/user"
substitute("Welcome $HOME", (s) => s.toLowerCase());
// => "Welcome home"
```

It's strict by default but designed to recover from errors gracefully.

```typescript
substitute("Hello, ${}", (x) => x);
// NoNameError: Expected variable name at column 8
substitute("Hello, ${}", (x) => x, { strict: false });
// => "Hello, ${}"
```

Bash and Windows CMD-style variables are both accepted, and can be disabled
individually.

```typescript
substitute("$HOME ${HOME}", (x) => x.toLowerCase());
// => "home home"
substitute("$HOME ${HOME}", (x) => x.toLowerCase(), { dollar: false });
// => "$HOME ${HOME}"

substitute("%USERPROFILE%", (x) => x.toLowerCase());
// => "userprofile"
substitute("%USERPROFILE%", (x) => x.toLowerCase(), { percent: false });
// => "%USERPROFILE%"
```

You can use a literal $ or % by doubling it, like `"$$"` or `"%%"`.

<br>

## Contributing

I'll endeavour to keep it working but I probably won't be adding anything new
myself. It does what I need it to. I'm more than happy to accept and help out
with PRs.

### Fair warning, though...

This code is extremely messy. The only goal when writing it was to make it work,
not to make it maintainable. Any negative side effects as a result of exposure
should be dealt with by a medical professional.
