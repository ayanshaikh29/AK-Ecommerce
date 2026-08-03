export function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return ''
  
  // Format to 2 decimal places to get rupees and paise
  const parsed = parseFloat(num).toFixed(2)
  const [rupeesStr, paiseStr] = parsed.split('.')
  const rupees = parseInt(rupeesStr, 10)
  const paise = parseInt(paiseStr, 10)
  
  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const doubleDigits = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  
  function convertLessThanThousand(n) {
    let temp = ""
    if (n >= 100) {
      temp += singleDigits[Math.floor(n / 100)] + " Hundred "
      n %= 100
    }
    if (n >= 10 && n < 20) {
      temp += teens[n - 10]
    } else if (n >= 20) {
      temp += doubleDigits[Math.floor(n / 10)] + " " + singleDigits[n % 10]
    } else if (n > 0) {
      temp += singleDigits[n]
    }
    return temp.trim()
  }
  
  function convertNumber(n) {
    if (n === 0) return "Zero"
    let word = ""
    
    // Crores (1,00,00,000)
    if (Math.floor(n / 10000000) > 0) {
      word += convertLessThanThousand(Math.floor(n / 10000000)) + " Crore "
      n %= 10000000
    }
    
    // Lakhs (1,00,000)
    if (Math.floor(n / 100000) > 0) {
      word += convertLessThanThousand(Math.floor(n / 100000)) + " Lakh "
      n %= 100000
    }
    
    // Thousands (1,000)
    if (Math.floor(n / 1000) > 0) {
      word += convertLessThanThousand(Math.floor(n / 1000)) + " Thousand "
      n %= 1000
    }
    
    word += convertLessThanThousand(n)
    return word.trim()
  }

  let rupeeWord = convertNumber(rupees)
  let paiseWord = paise > 0 ? convertNumber(paise) : ""

  let finalStr = "INR " + rupeeWord
  if (paise > 0) {
    finalStr += " and " + paiseWord + " Paise"
  }
  finalStr += " Only"
  
  return finalStr.replace(/\s+/g, ' ')
}
