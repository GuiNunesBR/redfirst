describe('list', () => {
  it('picks items', () => {
    cy.get('div > ul li a').click(); // expect: TL007
    cy.get('.item').first().click(); // expect: TL007
    cy.get('[data-cy=item]').first().click();
    cy.get('[data-cy=selected]').should('have.text', '1');
  });
});
