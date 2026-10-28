class ApiResult {
  constructor(result, response) {
    this.result = result
    this.response = response
    this.isError = !response?.ok ?? true
  }

  stringify() {
    if (this.result === null || this.result === undefined) {
      return String(this.result)
    }

    if (typeof this.result === 'string') {
      return this.result
    }

    if (typeof this.result === 'object') {
      try {
        return JSON.stringify(this.result, null, 2)
      }
      catch {
        return String(this.result)
      }
    }

    return String(this.result)
  }
}

export default ApiResult
