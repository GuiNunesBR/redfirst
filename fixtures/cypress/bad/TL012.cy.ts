describe('constants', () => {
  it('asserts constants', () => {
    cy.request('/api/health').then((response) => {
      expect(true).to.be.true; // expect: TL012
      expect(1).to.eq(1); // expect: TL012
      expect(response.status).to.eq(200);
    });
  });
});
