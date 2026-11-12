describe('profile', () => {
  it('saves the display name', () => {
    cy.visit('/profile');
    cy.get('[data-cy=name]').clear().type('Ana');
    cy.get('[data-cy=save]').click();
    cy.wait(5000);
    cy.get('[data-cy=status]').should('have.text', 'Saved');
  });
});
