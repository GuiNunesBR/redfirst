describe('login', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/login').as('login');
  });

  it('logs in and lands on the dashboard', () => {
    cy.visit('/login');
    cy.get('[data-cy=email]').type('user@example.com');
    cy.get('[data-cy=password]').type('secret', { log: false });
    cy.get('[data-cy=submit]').click();
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.location('pathname').should('eq', '/dashboard');
    cy.get('[data-cy=greeting]').should('contain.text', 'Welcome').and('contain.text', 'user');
  });

  it('rejects a wrong password', () => {
    cy.request({ method: 'POST', url: '/api/login', body: { email: 'x@example.com', password: 'bad' }, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(401);
        expect(response.body).to.deep.eq({ message: 'Invalid credentials' });
      },
    );
  });

  // Waiting on https://github.com/acme/shop/issues/31
  it.skip('locks the account after five attempts', () => {
    cy.get('[data-cy=alert]').should('have.text', 'Locked');
  });

  it('lists the recent orders', () => {
    cy.visit('/orders');
    cy.get('[data-cy=order-row]').should('have.length', 3);
    cy.get('[data-cy=order-row]').first().should('contain.text', '#1003');
  });
});
