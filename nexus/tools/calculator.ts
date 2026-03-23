/**
 * Basic Calculator Functions
 * A collection of common mathematical operations
 */

/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts the second number from the first
 * @param a - First number
 * @param b - Second number
 * @returns The difference of a and b
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides the first number by the second
 * @param a - Numerator
 * @param b - Denominator
 * @returns The quotient of a and b
 * @throws Error if attempting to divide by zero
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return a / b;
}

/**
 * Calculates the remainder of division
 * @param a - Dividend
 * @param b - Divisor
 * @returns The remainder of a divided by b
 */
export function modulo(a: number, b: number): number {
  return a % b;
}

/**
 * Raises a number to a power
 * @param base - The base number
 * @param exponent - The exponent
 * @returns base raised to the power of exponent
 */
export function power(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/**
 * Calculates the square root of a number
 * @param num - The number to calculate the square root of
 * @returns The square root of num
 * @throws Error if num is negative
 */
export function squareRoot(num: number): number {
  if (num < 0) {
    throw new Error("Cannot calculate square root of a negative number");
  }
  return Math.sqrt(num);
}

/**
 * Calculates the average of an array of numbers
 * @param numbers - Array of numbers
 * @returns The average value
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate average of empty array");
  }
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

/**
 * Finds the maximum value in an array of numbers
 * @param numbers - Array of numbers
 * @returns The maximum value
 */
export function max(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot find max of empty array");
  }
  return Math.max(...numbers);
}

/**
 * Finds the minimum value in an array of numbers
 * @param numbers - Array of numbers
 * @returns The minimum value
 */
export function min(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot find min of empty array");
  }
  return Math.min(...numbers);
}
