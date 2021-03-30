function parse(text) {
    var input = InputStream(text);
    var prog = [];
    var RX_SYMBOL = /^[a-z+=*/_<>!@$%&^-]$/i;

    while (!input.eof()) {
        prog.push(parse_expression());
        skip_whitespace();
    }
    return Cons.fromArray(prog);

    function parse_expression() {
        skip_whitespace();
        let ch = input.peek();
        if (ch == ";") {
            skip_comment();
            return parse_expression();
        }
        if (ch == "(") {
            return parse_list();
        }
        if (ch == "#") {
            input.next();
            let ch = input.next();
            if (ch == "t") return true;
            if (ch == "f") return false;
            input.croak(`Unsupported syntax #${ch}`);
        }
        if (RX_SYMBOL.test(ch)) {
            return read_symbol();
        }
        if (/^\d/.test(ch)) {
            return read_number();
        }
        if (ch == '"') {
            return read_string();
        }
        input.croak(`Unknown syntax ${input.substr()}`);
    }

    function read_symbol() {
        var name = read_while(ch => RX_SYMBOL.test(ch));
        return new Symbol(name);
    }

    function parse_list() {
        input.next();           // skip '('
        let array = [];
        while (!input.eof() && input.peek() != ")") {
            array.push(parse_expression());
            skip_whitespace();
        }
        if (input.next() != ")") {
            input.croak("Unterminated list");
        }
        return Cons.fromArray(array);
    }

    function read_escaped(end) {
        var escaped = false, str = "";
        input.next();
        while (!input.eof()) {
            var ch = input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch == "\\") {
                escaped = true;
            } else if (ch == end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }

    function read_string() {
        return read_escaped('"');
    }

    function read_number() {
        var has_dot = false;
        var number = read_while(function(ch){
            if (ch == ".") {
                if (has_dot) return false;
                has_dot = true;
                return true;
            }
            return is_digit(ch);
        });
        return parseFloat(number);
    }

    function is_digit(ch) {
        return /[0-9]/i.test(ch);
    }

    function read_while(predicate) {
        var str = "";
        while (!input.eof() && predicate(input.peek()))
            str += input.next();
        return str;
    }

    function skip_comment() {
        while (!input.eof() && input.peek() != "\n")
            input.next();
    }

    function skip_whitespace() {
        while (!input.eof() && /[\s\t\n]/.test(input.peek()))
            input.next();
    }

    function InputStream(input) {
        var pos = 0, line = 1, col = 0;
        return {
            next  : next,
            peek  : peek,
            eof   : eof,
            croak : croak,
            pos   : () => {
                return { pos: pos, line: line, col: col };
            },
            substr : () => {
                return input.substr(pos, 10);
            }
        };
        function next() {
            var ch = input.charAt(pos++);
            if (ch == "\n") line++, col = 0; else col++;
            return ch;
        }
        function peek() {
            return input.charAt(pos);
        }
        function eof() {
            return peek() == "";
        }
        function croak(msg) {
            throw new Error(msg + " (" + line + ":" + col + ":" + pos + ")");
        }
    }
}

class Cons {
    constructor(car, cdr) {
        this.car = car;
        this.cdr = cdr;
    }
    forEach(f) {
        let node = this, index = 0;
        while (node !== NIL) {
            f(node.car, index++);
            node = node.cdr;
        }
    }
    toArray() {
        let array = [];
        this.forEach(el => array.push(el));
        return array;
    }
}

let NIL = new Cons();
NIL.car = NIL;
NIL.cdr = NIL;

Cons.fromArray = function(array) {
    let node = NIL;
    for (let i = array.length - 1; i >= 0; i--) {
        let el = array[i];
        node = new Cons(el, node);
    }
    return node;
};

Cons.dump = function(list) {
    let body = [];
    while (list != NIL) {
        if (list.car instanceof Cons) {
            body.push(Cons.dump(list.car));
        } else if (typeof list.car == "string") {
            body.push(JSON.stringify(list.car));
        } else if (typeof list.car == "boolean") {
            body.push(`#${list.car ? "t" : "f"}`);
        } else {
            body.push(list.car);
        }
        list = list.cdr;
    }
    return `(${ body.join(" ") })`;
};

class Symbol {
    constructor(name) {
        this.name = name;
    }
    toString() {
        return this.name;
    }
}

function eval_lisp(body, env) {
    return eval_prog(body, env);

    function eval_prog(body, env) {
        let value = false;
        while (body !== NIL) {
            value = eval_expression(body.car, env);
            body = body.cdr;
        }
        return value;
    }

    function eval_expression(exp, env) {
        if (exp instanceof Cons) {
            return eval_list(exp, env);
        } else if (exp instanceof Symbol) {
            return env.get(exp.name);
        } else {
            return exp;
        }
    }

    // define, if
    function eval_list(exp, env) {
        if (exp.car instanceof Symbol) {
            let sym = exp.car;
            switch (sym.name) {
              case "define": {
                  let name = exp.cdr.car;  // name
                  let value = exp.cdr.cdr.car; // value
                  env.def(name, eval_expression(value, env));
                  return value;
              }

              case "set!": {
                  let name = exp.cdr.car;  // name
                  let value = exp.cdr.cdr.car; // value
                  env.set(name, eval_expression(value, env));
                  return value;
              }

              case "if": {
                  let cond = exp.cdr.car;
                  let then = exp.cdr.cdr.car;
                  if (then === NIL) throw new Error(`Missing then`);
                  let els = exp.cdr.cdr.cdr.car;
                  if (els === NIL) els = false;
                  if (eval_expression(cond, env)) {
                      return eval_expression(then, env);
                  } else {
                      return eval_expression(els, env);
                  }
              }

              case "lambda": {
                  let varnames = exp.cdr.car;
                  let body = exp.cdr.cdr;
                  varnames.forEach(sym => {
                      if (!(sym instanceof Symbol))
                          throw new Error("Expecting symbol in lambda list");
                  });
                  return function(...args) {
                      let innerEnv = new Environment(env);
                      varnames.forEach((sym, index) =>
                          innerEnv.def(sym.name, index < args.length ? args[index] : false)
                      );
                      return eval_prog(body, innerEnv);
                  };
              }
            }

            // (print a b)
            let func = env.get(sym.name);
            let args = [];
            let node = exp.cdr;
            while (node !== NIL) {
                args.push(eval_expression(node.car, env));
                node = node.cdr;
            }
            return func.apply(null, args);
        }
    }
}

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.vars = Object.create(null);
    }
    lookup(name) {
        let env = this;
        while (env && !env.has(name))
            env = env.parent;
        return env;
    }
    has(name) {
        return name in this.vars;
    }
    get(name) {
        let env = this.lookup(name);
        if (env) return env.vars[name];
        else throw new Error(`Undefined variable ${name}`);
    }
    set(name, value) {
        let env = this.lookup(name);
        if (env) env.vars[name] = value;
        else throw new Error(`Undefined variable ${name}`);
    }
    def(name, value) {
        this.vars[name] = value;
    }
}


////// EOF

let code = `
(define a (+ (* 2 3) 3))
(define b 6)
(print (+ a b))
(set! b 7)
(print (+ a b))

(define fib
  (lambda (n)
    (if (< n 2)
        n
        (+ (fib (- n 1))
           (fib (- n 2))))))

(print (fib 30))
  `;
let ast = parse(code);

let env = new Environment();
env.def("print", function(thing) {
    console.log(thing);
});
env.def("+", function() {
    let sum = 0;
    for (var i = 0; i < arguments.length; ++i) {
        sum += arguments[i];
    }
    return sum;
});
env.def("-", function() {
    if (arguments.length == 1) return -arguments[0];
    let sum = arguments[0];
    for (var i = 1; i < arguments.length; ++i) {
        sum -= arguments[i];
    }
    return sum;
});
env.def("<", function(a, b) {
    return a < b;
});
env.def("*", function() {
    let ret = 1;
    for (var i = 0; i < arguments.length; ++i) {
        ret *= arguments[i];
    }
    return ret;
});

eval_lisp(ast, env);
