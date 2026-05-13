export class InsufficientStockError extends Error {
  constructor() {
    super('Not enough stock available')
    this.name = 'InsufficientStockError'
  }
}

export class ReservationExpiredError extends Error {
  constructor() {
    super('Reservation has expired')
    this.name = 'ReservationExpiredError'
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super('Reservation not found')
    this.name = 'ReservationNotFoundError'
  }
}

export class InvalidStatusError extends Error {
  constructor(message = 'Invalid reservation status for this action') {
    super(message)
    this.name = 'InvalidStatusError'
  }
}