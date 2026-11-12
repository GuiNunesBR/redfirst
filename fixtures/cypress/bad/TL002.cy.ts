describe('home', () => {
  it('waits the wrong way', () => {
    cy.intercept('GET', '/api/home').as('load');
    cy.visit('/');
    cy.wait(1000); // expect: TL002
    cy.wait('@load');
    cy.get('[data-cy=title]').should('have.text', 'Home');
  });
});
