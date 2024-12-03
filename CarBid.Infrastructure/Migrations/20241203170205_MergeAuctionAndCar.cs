using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CarBid.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MergeAuctionAndCar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Auctions_Cars_CarId",
                schema: "public",
                table: "Auctions");

            migrationBuilder.DropTable(
                name: "Cars",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Auctions_CarId",
                schema: "public",
                table: "Auctions");

            migrationBuilder.RenameColumn(
                name: "CarId",
                schema: "public",
                table: "Auctions",
                newName: "Year");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "public",
                table: "Auctions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Make",
                schema: "public",
                table: "Auctions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Model",
                schema: "public",
                table: "Auctions",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                schema: "public",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "Make",
                schema: "public",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "Model",
                schema: "public",
                table: "Auctions");

            migrationBuilder.RenameColumn(
                name: "Year",
                schema: "public",
                table: "Auctions",
                newName: "CarId");

            migrationBuilder.CreateTable(
                name: "Cars",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Make = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    StartingPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cars", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Auctions_CarId",
                schema: "public",
                table: "Auctions",
                column: "CarId");

            migrationBuilder.AddForeignKey(
                name: "FK_Auctions_Cars_CarId",
                schema: "public",
                table: "Auctions",
                column: "CarId",
                principalSchema: "public",
                principalTable: "Cars",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
