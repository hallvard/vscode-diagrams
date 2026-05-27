package org.example;

public class App implements Runnable {

  @Override
  public void run() {
    System.out.println("Hello, World!");
  }

  public static void main(String[] args) {
    App app = new App();
    app.run();
  }
}
