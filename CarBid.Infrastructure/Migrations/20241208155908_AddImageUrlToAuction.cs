using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarBid.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImageUrlToAuction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                schema: "public",
                table: "Auctions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                schema: "public",
                table: "Auctions");
        }
    }
}
