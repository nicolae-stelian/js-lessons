// function fib(n) {
//     if (n <= 1) return 1;
//     return fib(n - 1) + fib(n - 2);
// }

function memoize(compute) {
    let cache = Object.create(null);
    return function(value) {
        if (value in cache)
            return cache[value];
        return cache[value] = compute(value);
    };
}

let fib = memoize(n => {
    if (n <= 1) return 1;
    return fib(n - 1) + fib(n - 2);
});

console.time("fib");
console.log(fib(40));
console.timeEnd("fib");
